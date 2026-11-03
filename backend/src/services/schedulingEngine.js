const { PriorityQueue } = require('../dsa/PriorityQueue');
const { calculatePriorityScore } = require('../utils/scoring');
const destinationSortingService = require('./sortingService');
const pool = require('../config/db');

/**
 * Module 6: Scheduling Engine
 * Selects parcels for a specific route departure respecting deadline feasibility and truck weight capacity.
 */
class SchedulingEngine {
  /**
   * Run allocation for a candidate truck departure
   */
  async scheduleDeparture(departureCandidate, simTime = new Date()) {
    const {
      route_id,
      estimated_travel_hours,
      processing_buffer_hours,
      truck,
      departure
    } = departureCandidate;

    const plannedDepartureTime = new Date(departure.scheduled_departure);
    const truckCapacity = parseFloat(truck.capacity);

    // 1. Get eligible waiting parcels from Route Linked List (Module 4)
    const routeGroup = destinationSortingService.getGroup(route_id);
    let candidateParcels = routeGroup ? routeGroup.toArray() : [];

    // Fallback: If in-memory linked list was empty, query DB for any awaiting parcels
    if (candidateParcels.length === 0) {
      const [dbParcels] = await pool.query(
        `SELECT p.* FROM parcels p
         LEFT JOIN batch_parcels bp ON p.parcel_id = bp.parcel_id
         WHERE p.route_id = ? 
           AND p.status IN ('Sorted', 'Awaiting Dispatch') 
           AND bp.batch_parcel_id IS NULL`,
        [route_id]
      );
      candidateParcels = dbParcels.map(p => ({
        parcel_id: p.parcel_id,
        tracking_id: p.tracking_id,
        route_id: p.route_id,
        weight: parseFloat(p.weight),
        urgency: p.urgency,
        arrival_time: p.arrival_time,
        deadline: p.deadline,
        max_wait_hours: p.max_wait_hours
      }));
    }

    const routeInfo = { estimated_travel_hours, processing_buffer_hours };
    const leadTimeMs = (estimated_travel_hours + processing_buffer_hours) * 3600 * 1000;
    const estimatedDeliveryTime = new Date(plannedDepartureTime.getTime() + leadTimeMs);

    // 2. Classify parcels: Feasible, Deadline-Critical, Non-Mandatory, or Already Overdue
    const deadlineCritical = [];
    const nonMandatory = [];
    const overdueOrInfeasible = [];

    for (const p of candidateParcels) {
      const { priorityScore, factors } = calculatePriorityScore(p, routeInfo, plannedDepartureTime, simTime);
      const enrichedParcel = {
        ...p,
        priorityScore,
        factors,
        estimated_delivery_time: estimatedDeliveryTime
      };

      if (p.deadline) {
        const deadlineDate = new Date(p.deadline);

        if (estimatedDeliveryTime > deadlineDate) {
          // Cannot meet deadline on this departure
          enrichedParcel.feasibility_status = 'INFEASIBLE_FOR_SLOT';
          overdueOrInfeasible.push(enrichedParcel);
          continue;
        }

        // Deadline is feasible. Determine if it is deadline-critical (mandatory):
        // Latest safe departure is at or near current departure
        const latestSafeDeparture = factors.latest_safe_departure;
        const slackMs = latestSafeDeparture.getTime() - plannedDepartureTime.getTime();

        // If slack is <= 24 hours, or missing this departure would cause it to miss deadline
        if (slackMs <= 24 * 3600 * 1000) {
          enrichedParcel.is_mandatory = true;
          deadlineCritical.push(enrichedParcel);
        } else {
          enrichedParcel.is_mandatory = false;
          nonMandatory.push(enrichedParcel);
        }
      } else {
        // No deadline: non-mandatory eligible
        enrichedParcel.is_mandatory = false;
        nonMandatory.push(enrichedParcel);
      }
    }

    // 3. Sort deadline-critical parcels
    // Order: earliest latest-safe-departure, then highest priorityScore, then earliest arrival, then lowest ID
    deadlineCritical.sort((a, b) => {
      const lsdA = a.factors.latest_safe_departure ? a.factors.latest_safe_departure.getTime() : 0;
      const lsdB = b.factors.latest_safe_departure ? b.factors.latest_safe_departure.getTime() : 0;
      if (lsdA !== lsdB) return lsdA - lsdB;
      if (Math.abs(b.priorityScore - a.priorityScore) > 0.001) return b.priorityScore - a.priorityScore;
      return new Date(a.arrival_time) - new Date(b.arrival_time);
    });

    // 4. Capacity allocation
    let currentWeight = 0;
    const allocatedParcels = [];
    const capacityConflict = [];

    // Phase A: Reserve capacity for mandatory deadline-critical parcels first
    for (const p of deadlineCritical) {
      if (currentWeight + p.weight <= truckCapacity) {
        currentWeight += p.weight;
        allocatedParcels.push(p);
      } else {
        p.rejection_reason = 'TRUCK_CAPACITY_EXCEEDED_MANDATORY';
        capacityConflict.push(p);
      }
    }

    // Phase B: Rank remaining non-mandatory parcels using Priority Queue (Binary Max-Heap)
    const pq = new PriorityQueue();
    for (const p of nonMandatory) {
      pq.push(p);
    }

    const unallocatedEligible = [];
    while (!pq.isEmpty()) {
      const topParcel = pq.pop();
      if (currentWeight + topParcel.weight <= truckCapacity) {
        currentWeight += topParcel.weight;
        allocatedParcels.push(topParcel);
      } else {
        topParcel.rejection_reason = 'TRUCK_CAPACITY_EXCEEDED';
        unallocatedEligible.push(topParcel);
      }
    }

    return {
      scheduled_departure: plannedDepartureTime,
      truck_id: truck.truck_id,
      truck_number: truck.truck_number,
      route_id,
      truck_capacity: truckCapacity,
      allocated_weight: parseFloat(currentWeight.toFixed(2)),
      remaining_capacity: parseFloat((truckCapacity - currentWeight).toFixed(2)),
      allocated_count: allocatedParcels.length,
      allocated_parcels: allocatedParcels,
      capacity_conflict_parcels: capacityConflict,
      unallocated_eligible_parcels: unallocatedEligible,
      infeasible_parcels: overdueOrInfeasible
    };
  }
}

const schedulingEngine = new SchedulingEngine();
module.exports = schedulingEngine;

