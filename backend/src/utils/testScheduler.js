/**
 * Module 6 Test Suite: Scheduling Engine & Priority Queue
 * Run directly via: node src/utils/testScheduler.js
 */

const { PriorityQueue } = require('../dsa/PriorityQueue');
const { calculatePriorityScore } = require('../utils/scoring');
const schedulingEngine = require('../services/schedulingEngine');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function runTests() {
  console.log('====================================================');
  console.log('   Running Module 6 Scheduling Engine Test Suite     ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: Binary Max-Heap Priority Queue Ordering
  // ----------------------------------------------------
  console.log('--- Test 1: Priority Queue (Max-Heap) Ordering ---');
  const pq = new PriorityQueue();
  pq.push({ parcel_id: 1, priorityScore: 50.5, arrival_time: '2026-11-01T10:00:00Z' });
  pq.push({ parcel_id: 2, priorityScore: 85.0, arrival_time: '2026-11-01T10:00:00Z' });
  pq.push({ parcel_id: 3, priorityScore: 65.2, arrival_time: '2026-11-01T10:00:00Z' });

  assert(pq.size() === 3, 'PriorityQueue size is 3');
  const first = pq.pop();
  assert(first.parcel_id === 2 && first.priorityScore === 85.0, 'Top element has highest score (85.0)');
  const second = pq.pop();
  assert(second.parcel_id === 3 && second.priorityScore === 65.2, 'Second element has score 65.2');
  const third = pq.pop();
  assert(third.parcel_id === 1 && third.priorityScore === 50.5, 'Third element has score 50.5');
  assert(pq.isEmpty(), 'PriorityQueue is empty after 3 pops\n');

  // ----------------------------------------------------
  // TEST 2: Scoring Formula Calculations
  // ----------------------------------------------------
  console.log('--- Test 2: Priority Score Calculation Formula ---');
  const route = { estimated_travel_hours: 6, processing_buffer_hours: 1 };
  const departureTime = new Date('2026-11-02T10:00:00Z');
  const simTime = new Date('2026-11-02T08:00:00Z');

  // Urgent parcel with close deadline
  const urgentParcel = {
    parcel_id: 10,
    urgency: 'Urgent',
    arrival_time: new Date('2026-11-02T00:00:00Z'),
    deadline: new Date('2026-11-02T18:00:00Z'), // Lead time: 7h => delivery 17:00 => slack 1h
    max_wait_hours: 24
  };

  const normalParcel = {
    parcel_id: 11,
    urgency: 'Normal',
    arrival_time: new Date('2026-11-02T07:00:00Z'),
    deadline: null,
    max_wait_hours: 48
  };

  const scoreUrgent = calculatePriorityScore(urgentParcel, route, departureTime, simTime);
  const scoreNormal = calculatePriorityScore(normalParcel, route, departureTime, simTime);

  assert(scoreUrgent.priorityScore > scoreNormal.priorityScore, 'Urgent close-deadline parcel scores higher than normal no-deadline parcel');
  assert(scoreUrgent.factors.urgency_score === 1.0, 'Urgent urgency_score is 1.0');
  assert(scoreNormal.factors.urgency_score === 0.5, 'Normal urgency_score is 0.5');
  assert(scoreNormal.factors.deadline_pressure_score === 0, 'No-deadline parcel gets 0 deadline pressure score\n');

  // ----------------------------------------------------
  // TEST 3: Capacity & Mandatory Feasibility Allocation
  // ----------------------------------------------------
  console.log('--- Test 3: Scheduling Engine Allocation Logic ---');

  const departureCandidate = {
    route_id: 99,
    estimated_travel_hours: 6,
    processing_buffer_hours: 1, // Total lead time = 7 hours
    truck: {
      truck_id: 999,
      truck_number: 'TEST-TRUCK-01',
      capacity: 100.0 // 100 kg capacity limit
    },
    departure: {
      scheduled_departure: '2026-11-02T10:00:00Z'
    }
  };

  // Mock waiting parcels for route 99 in sorting service
  const destinationSortingService = require('../services/sortingService');
  const mockGroup = destinationSortingService.ensureGroupExists(99, 'Test Group');
  mockGroup.head = null;
  mockGroup.tail = null;
  mockGroup.length = 0;

  // Parcel A: 40 kg, Deadline Critical (mandatory)
  mockGroup.append({
    parcel_id: 101,
    tracking_id: 'PCL-A-MANDATORY',
    route_id: 99,
    weight: 40.0,
    urgency: 'Urgent',
    arrival_time: new Date('2026-11-02T01:00:00Z'),
    deadline: new Date('2026-11-02T18:00:00Z'), // Delivers at 17:00, slack 1 hr -> Critical
    max_wait_hours: 24
  });

  // Parcel B: 50 kg, High Priority Regular
  mockGroup.append({
    parcel_id: 102,
    tracking_id: 'PCL-B-REGULAR-HIGH',
    route_id: 99,
    weight: 50.0,
    urgency: 'Urgent',
    arrival_time: new Date('2026-11-01T12:00:00Z'),
    deadline: new Date('2026-11-04T12:00:00Z'), // Lots of slack
    max_wait_hours: 48
  });

  // Parcel C: 30 kg, Exceeds Remaining Capacity (40 + 50 + 30 = 120 > 100)
  mockGroup.append({
    parcel_id: 103,
    tracking_id: 'PCL-C-OVER-CAPACITY',
    route_id: 99,
    weight: 30.0,
    urgency: 'Normal',
    arrival_time: new Date('2026-11-02T06:00:00Z'),
    deadline: null,
    max_wait_hours: 48
  });

  // Parcel D: 10 kg, Infeasible (Deadline at 15:00, but departure 10:00 + 7h = 17:00 arrival)
  mockGroup.append({
    parcel_id: 104,
    tracking_id: 'PCL-D-INFEASIBLE',
    route_id: 99,
    weight: 10.0,
    urgency: 'Urgent',
    arrival_time: new Date('2026-11-02T07:00:00Z'),
    deadline: new Date('2026-11-02T15:00:00Z'), // Impossible to make 7-hour journey by 15:00
    max_wait_hours: 24
  });

  schedulingEngine.scheduleDeparture(departureCandidate, simTime)
    .then(result => {
      // 1. Mandatory parcel A (40kg) must be allocated
      assert(
        result.allocated_parcels.some(p => p.parcel_id === 101),
        'Mandatory deadline-critical parcel 101 was reserved and allocated first'
      );

      // 2. High priority regular parcel B (50kg) allocated
      assert(
        result.allocated_parcels.some(p => p.parcel_id === 102),
        'High priority parcel 102 was allocated by Priority Queue'
      );

      // 3. Total weight should be 40 + 50 = 90kg <= 100kg
      assert(
        result.allocated_weight === 90.0,
        `Total allocated weight is exactly 90.0 kg (under 100 kg limit)`
      );

      // 4. Parcel C (30kg) exceeds remaining 10kg capacity, must be in unallocated_eligible
      assert(
        result.unallocated_eligible_parcels.some(p => p.parcel_id === 103),
        'Parcel 103 placed in unallocated list due to truck weight constraint'
      );

      // 5. Parcel D cannot meet deadline, must be marked infeasible
      assert(
        result.infeasible_parcels.some(p => p.parcel_id === 104),
        'Parcel 104 correctly classified as infeasible for this departure slot'
      );

      console.log('\n🎉 ALL SCHEDULING ENGINE TESTS PASSED SUCCESSFULLY! 🎉\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('Test execution error:', err);
      process.exit(1);
    });
}

runTests();

