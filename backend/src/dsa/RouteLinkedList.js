/**
 * Node for Route Linked List
 */
class RouteListNode {
  constructor(parcel) {
    this.parcel = parcel; // { parcel_id, tracking_id, route_id, weight, urgency, arrival_time, deadline, max_wait_hours }
    this.next = null;
  }
}

/**
 * Custom Singly Linked List for a specific Destination / Route Group
 */
class RouteLinkedList {
  constructor(routeId, groupName = '') {
    this.routeId = routeId;
    this.groupName = groupName;
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  // Append a parcel to the end of the list
  append(parcel) {
    const node = new RouteListNode(parcel);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
  }

  // Remove a parcel node by parcel_id (e.g. when allocated to batch)
  remove(parcelId) {
    if (!this.head) return false;

    if (this.head.parcel.parcel_id === parcelId) {
      this.head = this.head.next;
      if (!this.head) {
        this.tail = null;
      }
      this.length--;
      return true;
    }

    let current = this.head;
    while (current.next && current.next.parcel.parcel_id !== parcelId) {
      current = current.next;
    }

    if (current.next) {
      if (current.next === this.tail) {
        this.tail = current;
      }
      current.next = current.next.next;
      this.length--;
      return true;
    }

    return false;
  }

  // Check if a parcel_id exists in this list
  contains(parcelId) {
    let current = this.head;
    while (current) {
      if (current.parcel.parcel_id === parcelId) return true;
      current = current.next;
    }
    return false;
  }

  // Return all parcels as an array
  toArray() {
    const result = [];
    let current = this.head;
    while (current) {
      result.push(current.parcel);
      current = current.next;
    }
    return result;
  }

  size() {
    return this.length;
  }

  isEmpty() {
    return this.length === 0;
  }
}

module.exports = { RouteLinkedList, RouteListNode };

