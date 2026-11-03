/**
 * Node for Linked Queue
 */
class QueueNode {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

/**
 * Custom Queue using Linked Nodes (O(1) Enqueue, O(1) Dequeue, O(1) Peek)
 */
class ParcelQueue {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  // Add to rear of queue
  enqueue(data) {
    const node = new QueueNode(data);
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
  }

  // Look at the front element without removing
  peek() {
    return this.head ? this.head.data : null;
  }

  // Remove from front of queue
  dequeue() {
    if (!this.head) return null;
    const removedData = this.head.data;
    this.head = this.head.next;
    if (!this.head) {
      this.tail = null;
    }
    this.length--;
    return removedData;
  }

  isEmpty() {
    return this.length === 0;
  }

  size() {
    return this.length;
  }

  // Return all items as an array (for UI inspection)
  toArray() {
    const items = [];
    let current = this.head;
    while (current) {
      items.push(current.data);
      current = current.next;
    }
    return items;
  }

  // Check if parcelId is already in queue
  contains(parcelId) {
    let current = this.head;
    while (current) {
      if (current.data.parcel_id === parcelId) return true;
      current = current.next;
    }
    return false;
  }
}

module.exports = { ParcelQueue };

