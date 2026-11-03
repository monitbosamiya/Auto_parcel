/**
 * Custom Hash Table with Separate Chaining for O(1) Parcel Lookup Cache
 */
class HashTable {
  constructor(size = 64) {
    this.size = size;
    this.buckets = new Array(size).fill(null).map(() => []);
    this.count = 0;
  }

  // Hash function (djb2 hash algorithm)
  _hash(key) {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) + key.charCodeAt(i);
    }
    return Math.abs(hash) % this.size;
  }

  // Insert or update
  set(key, value) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    const existing = bucket.find(entry => entry.key === key);

    if (existing) {
      existing.value = value;
    } else {
      bucket.push({ key, value });
      this.count++;
      if (this.count > this.size * 0.75) {
        this._resize(this.size * 2);
      }
    }
  }

  // Lookup
  get(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    const entry = bucket.find(e => e.key === key);
    return entry ? entry.value : null;
  }

  // Delete
  delete(key) {
    const index = this._hash(key);
    const bucket = this.buckets[index];
    const itemIndex = bucket.findIndex(e => e.key === key);
    if (itemIndex !== -1) {
      bucket.splice(itemIndex, 1);
      this.count--;
      return true;
    }
    return false;
  }

  // Clear cache
  clear() {
    this.buckets = new Array(this.size).fill(null).map(() => []);
    this.count = 0;
  }

  // Dynamic resizing
  _resize(newSize) {
    const oldBuckets = this.buckets;
    this.size = newSize;
    this.buckets = new Array(newSize).fill(null).map(() => []);
    this.count = 0;

    for (const bucket of oldBuckets) {
      for (const entry of bucket) {
        this.set(entry.key, entry.value);
      }
    }
  }
}

module.exports = { HashTable };

