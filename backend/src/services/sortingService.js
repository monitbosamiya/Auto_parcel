const { RouteLinkedList } = require('../dsa/RouteLinkedList');
const pool = require('../config/db');

class DestinationSortingService {
  constructor() {
    // Map of route_id -> RouteLinkedList instance
    this.routeGroups = new Map();
  }

  /**
   * Initialize and rebuild route groups from MySQL on startup
   * Loads parcels with status 'Sorted' or 'Awaiting Dispatch' not assigned to an active batch
   */
  async initGroups() {
    try {
      this.routeGroups.clear();

      // 1. Load all destination groups/routes
      const [routes] = await pool.query(
        `SELECT r.route_id, r.origin, r.destination, dg.group_name 
         FROM routes r 
         LEFT JOIN destination_groups dg ON r.route_id = dg.route_id`
      );

      for (const route of routes) {
        const groupName = route.group_name || `${route.origin} -> ${route.destination}`;
        this.routeGroups.set(route.route_id, new RouteLinkedList(route.route_id, groupName));
      }

      // 2. Load awaiting parcels
      const [parcels] = await pool.query(
        `SELECT p.parcel_id, p.tracking_id, p.route_id, p.weight, p.urgency, 
                p.arrival_time, p.deadline, p.max_wait_hours, p.status 
         FROM parcels p
         LEFT JOIN batch_parcels bp ON p.parcel_id = bp.parcel_id
         WHERE p.status IN ('Sorted', 'Awaiting Dispatch') AND bp.batch_parcel_id IS NULL
         ORDER BY p.arrival_time ASC, p.parcel_id ASC`
      );

      for (const parcel of parcels) {
        let group = this.routeGroups.get(parcel.route_id);
        if (!group) {
          group = new RouteLinkedList(parcel.route_id);
          this.routeGroups.set(parcel.route_id, group);
        }
        group.append(parcel);
      }

      console.log(`[DestinationSorting] Initialized ${this.routeGroups.size} route groups with ${parcels.length} total awaiting parcels.`);
    } catch (error) {
      console.error('[DestinationSorting] Failed to init groups:', error.message);
    }
  }

  getGroup(routeId) {
    return this.routeGroups.get(Number(routeId)) || null;
  }

  ensureGroupExists(routeId, groupName = '') {
    const id = Number(routeId);
    if (!this.routeGroups.has(id)) {
      this.routeGroups.set(id, new RouteLinkedList(id, groupName));
    }
    return this.routeGroups.get(id);
  }

  /**
   * Sort a parcel into its route linked list
   */
  async sortParcel(parcelRef) {
    const parcelId = parcelRef.parcel_id;
    const connection = await pool.getConnection();

    try {
      // Fetch full authoritative parcel record
      const [rows] = await connection.query(
        `SELECT p.*, r.origin, r.destination 
         FROM parcels p 
         JOIN routes r ON p.route_id = r.route_id 
         WHERE p.parcel_id = ?`,
        [parcelId]
      );

      if (rows.length === 0) {
        throw new Error(`Parcel ID ${parcelId} not found`);
      }

      const parcel = rows[0];

      if (['Batched', 'Dispatched', 'Delivered', 'Exception'].includes(parcel.status)) {
        throw new Error(`Parcel ${parcel.tracking_id} cannot be sorted because its status is '${parcel.status}'`);
      }

      const routeId = parcel.route_id;
      const group = this.ensureGroupExists(routeId, `${parcel.origin} -> ${parcel.destination}`);

      if (group.contains(parcelId)) {
        throw new Error(`Parcel ${parcel.tracking_id} is already in the destination group for Route ${routeId}`);
      }

      await connection.beginTransaction();

      // Update status to 'Sorted' then 'Awaiting Dispatch'
      await connection.query(
        `UPDATE parcels SET status = 'Awaiting Dispatch' WHERE parcel_id = ?`,
        [parcelId]
      );

      await connection.query(
        `INSERT INTO parcel_status_history (parcel_id, previous_status, new_status, remarks)
         VALUES (?, ?, 'Awaiting Dispatch', 'Sorted into route linked list; awaiting truck dispatch')`,
        [parcelId, parcel.status]
      );

      await connection.commit();

      // Append to the in-memory route linked list
      const parcelData = {
        parcel_id: parcel.parcel_id,
        tracking_id: parcel.tracking_id,
        route_id: parcel.route_id,
        origin: parcel.origin,
        destination: parcel.destination,
        weight: parseFloat(parcel.weight),
        urgency: parcel.urgency,
        arrival_time: parcel.arrival_time,
        deadline: parcel.deadline,
        max_wait_hours: parcel.max_wait_hours
      };

      group.append(parcelData);

      return {
        success: true,
        route_id: routeId,
        group_name: group.groupName,
        group_size: group.size(),
        parcel: parcelData
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Remove parcel from route group (used when a parcel is allocated to a batch)
  removeFromGroup(routeId, parcelId) {
    const group = this.getGroup(routeId);
    if (group) {
      return group.remove(parcelId);
    }
    return false;
  }

  // Snapshot of all route groups and their linked list contents
  getAllGroupsSnapshot() {
    const snapshot = [];
    for (const [routeId, group] of this.routeGroups.entries()) {
      snapshot.push({
        route_id: routeId,
        group_name: group.groupName,
        parcel_count: group.size(),
        parcels: group.toArray()
      });
    }
    return snapshot;
  }
}

// Singleton instance
const destinationSortingService = new DestinationSortingService();
module.exports = destinationSortingService;

