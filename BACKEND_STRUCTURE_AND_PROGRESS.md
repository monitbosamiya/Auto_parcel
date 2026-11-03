# Automatic Parcel Sorting & Dispatch Simulator - Full Architecture & Progress Report

## 1. Overview & Progress Summary
The system is built as a college working prototype using **Node.js, Express.js, MySQL 8.0+**, and a **React (Vite) frontend**, strictly adhering to the specification. Core data structures are implemented from scratch in JavaScript (Queue, Singly Linked List, Binary Max-Heap Priority Queue).

### Completed Modules Status:
- **Module 1: Authentication & Parcel Registration** 
  - **Backend:** Admin login with bcrypt + JWT authentication (`POST /api/auth/login`), unique collision-safe tracking ID generator (`PCL-YYYYMMDD-XXXX`), and parcel persistence in MySQL.
  - **Frontend:** Single-operator login screen (`/login`) with auto-redirects and JWT bearer injection.
- **Module 2: Parcel Validation**
  - **Backend:** Validation engine checking route matching, truck service availability, truck max capacity constraints ($w_{\text{parcel}} \le C_{\text{truck}}$), and deadline sanity ($\text{deadline} \ge \text{arrival}$).
  - **Frontend:** Interactive parcel registration form (`/register`) with instant pre-submission rule validation.
- **Module 3: Incoming Queue Management**
  - **Backend:** Custom Linked-Node FIFO Queue (`ParcelQueue.js`) with $O(1)$ operations, safe dequeue pattern (DB transition before in-memory pop), and automated MySQL state recovery on restart.
  - **Frontend:** Real-time incoming FIFO queue viewer (`/queue`) with front/peek indicator and safe dequeue action.
- **Module 4: Destination Sorting**
  - **Backend:** Custom Singly Linked List (`RouteLinkedList.js`) grouped by shipping route (`Map<route_id, RouteLinkedList>`), status transition to `'Awaiting Dispatch'`, and queue-to-group processing endpoints.
- **Module 5: Route & Fleet Management**
  - **Backend:** CRUD for routes, trucks, recurring schedules (`MON,WED,FRI`), and dynamic departure instance candidate calculations based on simulation clock.
- **Module 6: Scheduling Engine**
  - **Backend:** Custom Binary Max-Heap Priority Queue (`PriorityQueue.js`), 4-factor normalized scoring formula ($Urgency \times 30 + Deadline \times 35 + Travel \times 15 + Wait \times 20$), deadline slack calculations, mandatory reservation, and capacity constraint evaluation. Unit test suite verified (`npm run test-scheduler`).
- **Module 7: Batch Generation**
  - **Backend:** Transactional batch generation (`POST /api/batches/generate` & `/auto-generate`), junction table linkage (`batch_parcels`), weight recalculation against truck capacity, status audit logging (`'Batched'`), and removal from runtime route linked lists.
- **Module 8: Dispatch Management**
  - **Backend:** Departure evaluation against simulation clock, due batches query (`GET /api/dispatch/due`), atomic departure dispatch (`POST /api/dispatch/process`), batch and parcel status progression (`'Dispatched'`), truck state change (`'In Transit'`), and audit logging into `dispatch_history` and `parcel_status_history`.
- **Module 9: Tracking & Status Management**
  - **Backend:** Custom Hash Table (`HashTable.js`) with djb2 hashing and separate chaining for $O(1)$ fast lookup caching, combined with MySQL multi-table joins (`parcels`, `routes`, `batches`, `trucks`, `dispatch_history`, `parcel_status_history`). Endpoints: `GET /api/tracking/:tracking_id` and `POST /api/tracking/lookup`.

---

## 2. Directory Structure

```text
Assingment1/
├── BACKEND_STRUCTURE_AND_PROGRESS.md
├── automatic_parcel_sorting_dispatch_spec_updated.md
├── setup_and_start.bat
│
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── sql/
│   │   └── schema_and_seed.sql
│   └── src/
│       ├── server.js
│       ├── config/
│       │   └── db.js
│       ├── dsa/
│       │   ├── ParcelQueue.js
│       │   ├── RouteLinkedList.js
│       │   └── PriorityQueue.js
│       ├── middleware/
│       │   └── auth.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── parcelController.js
│       │   ├── queueController.js
│       │   ├── sortingController.js
│       │   ├── fleetController.js
│       │   ├── schedulingController.js
│       │   └── batchController.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── parcelRoutes.js
│       │   ├── queueRoutes.js
│       │   ├── sortingRoutes.js
│       │   ├── fleetRoutes.js
│       │   ├── schedulingRoutes.js
│       │   └── batchRoutes.js
│       ├── services/
│       │   ├── validationService.js
│       │   ├── queueService.js
│       │   ├── sortingService.js
│       │   ├── routeTruckService.js
│       │   ├── schedulingEngine.js
│       │   └── batchService.js
│       └── utils/
│           ├── initDb.js
│           ├── scoring.js
│           └── testScheduler.js
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── index.css                 # Custom Palette (--frozen-water, --pacific-blue, --yale-blue, etc.)
        ├── main.jsx
        ├── App.jsx                   # React Router with Auth guard
        ├── components/
        │   └── Navbar.jsx            # Top navigation bar across modules
        ├── context/
        │   └── AuthContext.jsx       # Single-operator auth state
        ├── services/
        │   └── api.js                # Axios instance with auto JWT attachment
        └── pages/
            ├── Login.jsx             # Module 1: Operator Sign-in
            ├── RegisterParcel.jsx    # Module 1 & 2: Registration & Validation Form
            └── IncomingQueue.jsx     # Module 3: FIFO Queue Visualizer & Dequeue
```

---

## 3. Detailed File Breakdown: Functions & Features

### A. Configuration & Startup
* **[`src/config/db.js`](file:///f:/MCA/DSA/Assingment1/backend/src/config/db.js)**
  * **Functions:** Exports a `mysql2/promise` connection pool using `.env` credentials.
  * **Features:** Manages connection pooling, handles connection limits, and supports transactions.
* **[`src/server.js`](file:///f:/MCA/DSA/Assingment1/backend/src/server.js)**
  * **Functions:** Configures Express middleware (`cors`, `express.json`), mounts all 6 module routers, and starts the HTTP server.
  * **Features:** On server startup, automatically calls `incomingQueueManager.initQueue()` and `destinationSortingService.initGroups()` to rebuild runtime DSA structures from MySQL.

---

### B. Custom Data Structures (`src/dsa/`)
* **[`src/dsa/ParcelQueue.js`](file:///f:/MCA/DSA/Assingment1/backend/src/dsa/ParcelQueue.js)**
  * **Classes:** `QueueNode`, `ParcelQueue`
  * **Methods:** `enqueue(data)`, `dequeue()`, `peek()`, `isEmpty()`, `size()`, `toArray()`, `contains(parcelId)`
  * **Features:** Demonstrates custom Linked Queue implementation without using JavaScript's native `Array.shift()`. Runs enqueue and dequeue in $O(1)$ time complexity.
* **[`src/dsa/RouteLinkedList.js`](file:///f:/MCA/DSA/Assingment1/backend/src/dsa/RouteLinkedList.js)**
  * **Classes:** `RouteListNode`, `RouteLinkedList`
  * **Methods:** `append(parcel)`, `remove(parcelId)`, `contains(parcelId)`, `toArray()`, `size()`, `isEmpty()`
  * **Features:** Singly linked list holding awaiting parcels for each route with `head` and `tail` pointers.
* **[`src/dsa/PriorityQueue.js`](file:///f:/MCA/DSA/Assingment1/backend/src/dsa/PriorityQueue.js)**
  * **Classes:** `PriorityQueue`
  * **Methods:** `push(item)`, `pop()`, `peek()`, `_bubbleUp(index)`, `_sinkDown(index)`, `toArray()`, `size()`
  * **Features:** Binary Max-Heap implementation with $O(\log n)$ inserts and extracts. Includes multi-tier tie-breakers: `priorityScore` $\rightarrow$ earlier deadline $\rightarrow$ longer waiting time $\rightarrow$ lower parcel ID.

---

### C. Services & Business Logic (`src/services/` & `src/utils/`)
* **[`src/services/validationService.js`](file:///f:/MCA/DSA/Assingment1/backend/src/services/validationService.js)**
  * **Function:** `validateParcelData(parcelInput, dbConnection)`
  * **Features:** Enforces strict validation: non-empty names, different origin & destination, active route matching, assigned trucks and schedule checks, max truck capacity bounds, and deadline feasibility.
* **[`src/services/queueService.js`](file:///f:/MCA/DSA/Assingment1/backend/src/services/queueService.js)**
  * **Methods:** `initQueue()`, `enqueueParcel(parcelRef)`, `peekNext()`, `dequeueAndAdvanceStatus(newStatus, remarks)`, `getQueueSnapshot()`
  * **Features:** Singleton managing the incoming FIFO queue. Implements safe dequeue patterns (updates MySQL status and audits to `parcel_status_history` before popping in memory).
* **[`src/services/sortingService.js`](file:///f:/MCA/DSA/Assingment1/backend/src/services/sortingService.js)**
  * **Methods:** `initGroups()`, `sortParcel(parcelRef)`, `getGroup(routeId)`, `ensureGroupExists(routeId, groupName)`, `removeFromGroup(routeId, parcelId)`, `getAllGroupsSnapshot()`
  * **Features:** Maintains a `Map<route_id, RouteLinkedList>`. Transfers parcels from the FIFO queue into route linked lists with status `'Awaiting Dispatch'`.
* **[`src/services/routeTruckService.js`](file:///f:/MCA/DSA/Assingment1/backend/src/services/routeTruckService.js)**
  * **Functions:** `getNextDepartureDate(timeStr, daysStr, fromDate)`, `getUpcomingDepartureCandidates(routeId, simTime)`
  * **Features:** Calculates real upcoming departure dates based on recurring schedules (`MON,TUE...`), filters out trucks in `Maintenance`, and checks existing batches to prevent duplicate allocations.
* **[`src/utils/scoring.js`](file:///f:/MCA/DSA/Assingment1/backend/src/utils/scoring.js)**
  * **Function:** `calculatePriorityScore(parcel, routeInfo, departureTime, simTime)`
  * **Features:** Computes priority score based on:
    $$\text{score} = (\text{urgency} \times 30) + (\text{deadline\_pressure} \times 35) + (\text{travel\_time} \times 15) + (\text{waiting\_time} \times 20)$$
    bounded between $0$ and $100$.
* **[`src/services/schedulingEngine.js`](file:///f:/MCA/DSA/Assingment1/backend/src/services/schedulingEngine.js)**
  * **Method:** `scheduleDeparture(departureCandidate, simTime)`
  * **Features:** Core scheduling engine:
    1. Fetches candidate parcels from the route's linked list (with MySQL fallback).
    2. Identifies feasibility against `latest_safe_departure = deadline - travel_time - buffer`.
    3. Mandatory deadline-critical parcels are reserved first.
    4. Remaining truck weight capacity is filled using the Binary Max-Heap Priority Queue.
    5. Outputs categorized buckets: `allocated_parcels`, `capacity_conflict_parcels`, `unallocated_eligible_parcels`, and `infeasible_parcels`.

---

### D. Controllers & Route Endpoints

| Route Prefix | Method | Endpoint | Handler | Protected | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth` | `POST` | `/login` | `login` | No | Authenticates single operator (`admin`/`admin123`) & issues JWT |
| `/api/parcels` | `POST` | `/register` | `registerParcel` | Yes | Validates parcel, inserts to DB, and pushes to FIFO queue |
| `/api/parcels` | `POST` | `/validate` | `validateParcel` | Yes | Pre-submission validation check |
| `/api/parcels` | `GET` | `/` | `getRegisteredParcels` | Yes | Retrieves registered parcels with route information |
| `/api/queue` | `GET` | `/status` | `getQueueStatus` | Yes | Inspects in-memory FIFO queue items & size |
| `/api/queue` | `POST` | `/dequeue` | `dequeueNext` | Yes | Safely dequeues top item from incoming queue |
| `/api/sorting` | `GET` | `/groups` | `getDestinationGroups` | Yes | Returns all route linked lists and their parcels |
| `/api/sorting` | `POST` | `/process-next` | `processNextFromQueue` | Yes | Dequeues 1 parcel from FIFO queue $\rightarrow$ sorts into Route Linked List |
| `/api/sorting` | `POST` | `/process-all` | `processAllFromQueue` | Yes | Dequeues and sorts all waiting parcels |
| `/api/fleet` | `GET` | `/routes` | `getAllRoutes` | Yes | Lists all routes with destination groups |
| `/api/fleet` | `POST` | `/routes` | `createRoute` | Yes | Creates new route and linked list destination group |
| `/api/fleet` | `GET` | `/trucks` | `getAllTrucks` | Yes | Lists trucks and assigned routes |
| `/api/fleet` | `POST` | `/trucks` | `createTruck` | Yes | Registers a new truck |
| `/api/fleet` | `PATCH` | `/trucks/:id/status`| `updateTruckStatus` | Yes | Updates truck status (`Available`, `In Transit`, `Maintenance`) |
| `/api/fleet` | `GET` | `/schedules` | `getAllSchedules` | Yes | Lists all departure schedules |
| `/api/fleet` | `POST` | `/schedules` | `createSchedule` | Yes | Creates new recurring departure schedule |
| `/api/fleet` | `GET` | `/upcoming-departures` | `getUpcomingDepartures` | Yes | Returns candidate departure instances for routes |
| `/api/scheduling` | `POST` | `/evaluate` | `evaluateSchedule` | Yes | Runs Scheduling Engine evaluation on a route |
| `/api/batches` | `GET` | `/` | `listBatches` | Yes | Lists all created batches with optional status filter |
| `/api/batches` | `GET` | `/:id` | `getBatch` | Yes | Retrieves full batch details including assigned parcels |
| `/api/batches` | `POST` | `/generate` | `generateBatch` | Yes | Creates batch from explicit plan/selected parcels |
| `/api/batches` | `POST` | `/auto-generate` | `autoScheduleAndBatch` | Yes | Evaluates scheduler and creates batch in one step |
| `/api/dispatch` | `GET` | `/due` | `listDueBatches` | Yes | Lists batches whose scheduled departure is due |
| `/api/dispatch` | `POST` | `/process` | `processDispatch` | Yes | Executes departure: marks truck In Transit & parcels Dispatched |
| `/api/dispatch` | `GET` | `/history` | `listDispatches` | Yes | Retrieves history of all actual departures |
| `/api/tracking` | `GET` | `/:tracking_id` | `trackParcel` | Yes | Looks up parcel details & chronological history |
| `/api/tracking` | `POST` | `/lookup` | `trackParcel` | Yes | Looks up parcel by tracking_id in body |

---

## 4. Next Step: Frontend Integration
With Modules 1 through 6 complete and tested on the backend, the React frontend can now be constructed to provide:
1. **Login Page**: JWT storage and route authentication guard.
2. **Parcel Registration Form**: Inputs with immediate validation feedback.
3. **Incoming Queue View**: Visualizing the FIFO Queue (Module 3) with a "Sort Next" / "Sort All" action.
4. **Destination Groups View**: Visualizing the Route Linked Lists (Module 4).
5. **Fleet & Schedule Management**: Adding/viewing routes, trucks, and schedules (Module 5).
6. **Scheduling Engine Dashboard**: Evaluating allocations and viewing Priority Queue decisions before batching (Module 6).

