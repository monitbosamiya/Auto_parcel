/**
 * Generic Priority Queue implemented as a Binary Heap
 * Default comparator configures it as a Max-Heap based on priorityScore and tie-breakers.
 */
class PriorityQueue {
  constructor(comparator = null) {
    this.heap = [];
    // Default comparator: returns > 0 if A has higher priority than B (Max Heap)
    this.comparator = comparator || PriorityQueue.defaultParcelComparator;
  }

  static defaultParcelComparator(a, b) {
    // 1. Higher priority score first
    if (Math.abs(a.priorityScore - b.priorityScore) > 0.001) {
      return a.priorityScore - b.priorityScore;
    }
    // 2. Earlier deadline first (parcels with deadlines beat NULL deadlines)
    if (a.deadline && b.deadline) {
      const diff = new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
      if (diff !== 0) return diff;
    } else if (a.deadline && !b.deadline) {
      return 1;
    } else if (!a.deadline && b.deadline) {
      return -1;
    }
    // 3. Longer waiting duration first (earlier arrival first)
    const arrivalDiff = new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime();
    if (arrivalDiff !== 0) return arrivalDiff;

    // 4. Lower parcel ID first
    return b.parcel_id - a.parcel_id;
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.comparator(this.heap[index], this.heap[parentIndex]) > 0) {
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      let largest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < length && this.comparator(this.heap[leftChild], this.heap[largest]) > 0) {
        largest = leftChild;
      }
      if (rightChild < length && this.comparator(this.heap[rightChild], this.heap[largest]) > 0) {
        largest = rightChild;
      }
      if (largest !== index) {
        [this.heap[index], this.heap[largest]] = [this.heap[largest], this.heap[index]];
        index = largest;
      } else {
        break;
      }
    }
  }

  toArray() {
    // Return clone sorted in priority order
    const clone = new PriorityQueue(this.comparator);
    clone.heap = [...this.heap];
    const sorted = [];
    while (!clone.isEmpty()) {
      sorted.push(clone.pop());
    }
    return sorted;
  }
}

module.exports = { PriorityQueue };

