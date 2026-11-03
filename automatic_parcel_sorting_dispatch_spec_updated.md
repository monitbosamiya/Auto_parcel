# Automatic Parcel Sorting & Dispatch Simulator

Very Strict Rules:- These is a college Project is should be treated as college project we have to make a working prototype not a production level system. and also you have to use less tokens to make a  working system.

## Software Requirements, Data Dictionary, Module Lifecycle, and Implementation Specification

**Document purpose:** This document is the implementation contract for a
coding agent. It defines the system scope, data model, MySQL schema,
module responsibilities, inputs, processing rules, outputs, state
transitions, API expectations, and acceptance criteria.

**Technology stack** - Frontend: React.js - Backend: Node.js +
Express.js - Language: JavaScript - Database: MySQL 8+ - Core data
structures implemented in JavaScript: Queue, Linked List, Priority Queue
(binary heap), and Hash Table. - Persistence: MySQL. JavaScript data
structures are runtime working structures; MySQL remains the source of
truth.

**In scope:** A single-operator login system using username/password
authentication and JWT.

**Out of scope:** A separate reports/analytics module, public user
registration, multiple operator accounts, role-based access control,
user management, payments, customer accounts, live GPS tracking, real
carrier integrations, route optimization across multiple cities, and
physical conveyor/vehicle control.

------------------------------------------------------------------------

# 1. Product overview

The application simulates a courier warehouse that receives parcels,
groups them by shipping route, evaluates delivery deadlines and waiting
time, allocates parcels to scheduled trucks, generates dispatch batches,
and records departures.

The central scheduling policy is:

1.  Parcels are grouped by their configured route (`origin` +
    `destination`).
2.  Each route has one or more trucks and recurring departure schedules.
3.  Before each scheduled departure, the scheduler evaluates parcels
    waiting for that route.
4.  It determines which parcels must leave on this departure to meet
    their delivery deadlines.
5.  It ranks other eligible parcels using a configurable score based on
    urgency, deadline pressure, travel time, and waiting time.
6.  It fills remaining capacity with eligible parcels, including parcels
    without deadlines.
7.  Parcels that are not selected remain waiting and are reconsidered at
    the next scheduling run.
8.  If a parcel cannot meet its deadline because of insufficient
    capacity or schedule availability, the system records a visible
    deadline/capacity conflict. It must not silently claim that the
    deadline can be met.
9.  Trucks depart at their scheduled time. The default policy is not to
    delay a truck merely to fill it.

## 1.1 Core principles

-   A parcel must belong to exactly one route.
-   A parcel can belong to at most one active/future batch at a time.
-   A batch must belong to one route, one truck, and one scheduled
    departure.
-   The sum of parcel weights in a batch must not exceed truck capacity.
-   A parcel's current status is stored on the parcel record; every
    status change is also appended to status history.
-   A batch assignment must be committed atomically.
-   Scheduling must be deterministic for the same input state and
    simulation time.
-   Running scheduling twice for the same route and departure must not
    create duplicate batches or duplicate parcel assignments.
-   No-deadline parcels are eligible to fill spare capacity, but their
    maximum waiting period must be respected as a scheduling target and
    surfaced as a conflict if it cannot be met.

------------------------------------------------------------------------

# 2. Terminology

  -----------------------------------------------------------------------
  Term                                Meaning
  ----------------------------------- -----------------------------------
  Parcel                              A shipment registered in the
                                      warehouse.

  Route                               A directed origin-to-destination
                                      path supported by the system.

  Truck                               A vehicle assigned to a route with
                                      a maximum weight capacity.

  Schedule                            A recurring departure rule for a
                                      truck.

  Departure instance                  A specific date and time generated
                                      from a recurring schedule.

  Destination group                   Runtime linked-list group
                                      containing waiting parcels for one
                                      route.

  Batch                               A set of parcels assigned to one
                                      truck departure.

  Latest safe departure               Latest time the parcel may leave
                                      the origin while still meeting its
                                      deadline, based on estimated travel
                                      and buffer.

  Deadline-critical parcel            Parcel whose next later feasible
                                      departure would miss its deadline,
                                      or whose latest safe departure is
                                      at/before the current departure.

  Deadline conflict                   A condition where available
                                      scheduled capacity cannot carry all
                                      parcels required to meet their
                                      deadlines.

  Simulation clock                    Application-controlled date/time
                                      used to test future schedules
                                      without waiting for real time.

  Maximum waiting period              Maximum target duration a parcel
                                      without a deadline should remain in
                                      the warehouse.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 3. System modules

The application has nine modules. There is no separate
analytics/reporting module.

  -------------------------------------------------------------------------
                    No. Module           Main             Main output
                                         responsibility   
  --------------------- ---------------- ---------------- -----------------
                      1 Parcel           Capture and      Newly registered
                        Registration     create parcel    parcel
                                         records          

                      2 Parcel           Validate parcel  Valid parcel or
                        Validation       data and route   validation errors
                                         availability     

                      3 Incoming Queue   Hold newly       Parcel references
                        Management       accepted parcels ready for sorting
                                         in FIFO order    

                      4 Destination      Group parcels by Route-wise
                        Sorting          route            waiting groups

                      5 Route & Truck    Maintain routes, Candidate truck
                        Management       trucks,          departure
                                         recurring        information
                                         schedules and    
                                         departure        
                                         instances        

                      6 Scheduling       Evaluate         Selected parcel
                        Engine           deadline         IDs and conflict
                                         feasibility and  details
                                         rank eligible    
                                         parcels          

                      7 Batch Generation Persist a batch  Generated/ready
                                         and assign       batch
                                         selected parcels 
                                         atomically       

                      8 Dispatch         Execute a due    Dispatch event
                        Management       departure and    and updated
                                         update records   statuses

                      9 Tracking &       Find parcels and Parcel tracking
                        Status           display current  result
                        Management       status/history   
  -------------------------------------------------------------------------

## 3.1 High-level flow

``` text
Parcel Registration
        |
        v
Parcel Validation <------ Route data
        |
        v
Incoming Queue (FIFO)
        |
        v
Destination Sorting (group by route)
        |
        +-----------------------------+
        |                             |
        v                             v
Route & Truck Management ------> Scheduling Engine
                                      |
                                      v
                               Batch Generation
                                      |
                                      v
                               Dispatch Management
                                      |
                                      v
                            Tracking & Status Management
```

Tracking is also a query path: it can be used at any time after a
tracking ID has been created. Status history is appended whenever a
parcel changes state.

------------------------------------------------------------------------

# 4. Data model and database dictionary

## 4.1 General database conventions

-   Database name: `parcel_dispatch_db`.
-   Use InnoDB for transaction support and foreign keys.
-   Use `utf8mb4`.
-   Store timestamps consistently. Recommended: store UTC in `DATETIME`
    fields and convert to the configured warehouse timezone at the
    API/UI boundary. If the project uses a single local timezone only,
    document that choice and apply it consistently.
-   Use `DECIMAL` for weight and time quantities; do not use
    floating-point database columns for these values.
-   IDs are internal numeric primary keys. Tracking IDs and batch codes
    are human-readable unique identifiers.
-   Store current state in the main entity table and append state
    transitions to history tables.
-   Do not store runtime Queue/Heap/Hash Table nodes in MySQL. Persist
    business records; rebuild runtime structures from MySQL when the
    server starts or when a module needs them.

## 4.2 Entity relationship summary

``` text
routes 1 -------- many trucks
routes 1 -------- many parcels
routes 1 -------- many batches
trucks 1 -------- many schedules
trucks 1 -------- many batches
schedules 1 ----- many batches
batches 1 ------- many batch_parcels
parcels 1 ------- zero/one active batch_parcels assignment
parcels 1 ------- many parcel_status_history rows
batches 1 ------- zero/one dispatch_history row
```

`destination_groups` stores one persistent group definition per route.
The actual linked list of waiting parcel references is created in
application memory and rebuilt from eligible parcel rows. Do not treat
the database group row as the linked-list nodes themselves.

## 4.3 `routes`

**Purpose:** Defines a directed shipping route.

  -------------------------------------------------------------------------------
  Field                     SQL type          Constraints       Description
  ------------------------- ----------------- ----------------- -----------------
  route_id                  INT               PK,               Internal route ID
                                              AUTO_INCREMENT    

  origin                    VARCHAR(100)      NOT NULL          Starting
                                                                warehouse/city

  destination               VARCHAR(100)      NOT NULL          Destination city

  estimated_travel_hours    DECIMAL(6,2)      NOT NULL, \> 0    Estimated journey
                                                                time

  processing_buffer_hours   DECIMAL(6,2)      NOT NULL, DEFAULT Safety/handling
                                              0, \>= 0          buffer
  -------------------------------------------------------------------------------

Additional constraint: `UNIQUE(origin, destination)`.

Rules: - A route is directional. Ahmedabad → Mumbai is different from
Mumbai → Ahmedabad. - A parcel must match a configured route. - Do not
silently create routes during parcel registration. - If a route is
disabled in a future enhancement, existing parcels/history must remain
readable.

## 4.4 `trucks`

**Purpose:** Stores vehicles and their assigned route.

  -----------------------------------------------------------------------------------
  Field                 SQL type                  Constraints       Description
  --------------------- ------------------------- ----------------- -----------------
  truck_id              INT                       PK,               Internal truck ID
                                                  AUTO_INCREMENT    

  truck_number          VARCHAR(30)               NOT NULL, UNIQUE  Vehicle
                                                                    identifier

  route_id              INT                       NOT NULL, FK →    Truck's assigned
                                                  routes.route_id   route

  capacity              DECIMAL(10,2)             NOT NULL, \> 0    Maximum cargo
                                                                    weight in kg

  availability_status   ENUM('Available','In      NOT NULL, DEFAULT Operational
                        Transit','Maintenance')   'Available'       status
  -----------------------------------------------------------------------------------

Rules: - A truck is assigned to one route in the initial version. - A
truck cannot be assigned to overlapping departure instances. - A truck
in Maintenance cannot receive a new batch. - Capacity is measured in
kilograms, not parcel count. - Do not mark a truck Available immediately
after departure; it remains In Transit until a configured
return/availability rule says it is available. For the basic simulation,
a configurable turnaround duration can be used.

## 4.5 `schedules`

**Purpose:** Stores recurring departure rules for a truck.

  --------------------------------------------------------------------------
  Field             SQL type          Constraints       Description
  ----------------- ----------------- ----------------- --------------------
  schedule_id       INT               PK,               Schedule ID
                                      AUTO_INCREMENT    

  truck_id          INT               NOT NULL, FK →    Associated truck
                                      trucks.truck_id   

  departure_time    TIME              NOT NULL          Local departure time

  departure_days    VARCHAR(100)      NOT NULL          Recurring days,
                                                        e.g. `MON,WED,FRI`

  is_active         BOOLEAN           NOT NULL, DEFAULT Whether schedule is
                                      TRUE              active
  --------------------------------------------------------------------------

Recommended improvement: store departure days in a normalized child
table `schedule_days(schedule_day_id, schedule_id, weekday)` rather than
comma-separated text. If keeping the original compact schema, use a
strict documented format such as `MON,TUE,WED,THU,FRI,SAT,SUN` and
validate it in the backend.

Rules: - A schedule is a recurring rule, not a specific departure
event. - The scheduler must calculate concrete departure instances
(date + time) from this rule. - Do not store `next_departure` as a
permanent source of truth; calculate it from the simulation clock and
active schedule. - If multiple schedules exist for a truck, ensure they
do not overlap with its travel/turnaround period.

## 4.6 `parcels`

**Purpose:** Stores the master record for each parcel.

  -----------------------------------------------------------------------------------------------------------------
  Field             SQL type                                                    Constraints       Description
  ----------------- ----------------------------------------------------------- ----------------- -----------------
  parcel_id         INT                                                         PK,               Internal parcel
                                                                                AUTO_INCREMENT    ID

  tracking_id       VARCHAR(30)                                                 NOT NULL, UNIQUE  Public tracking
                                                                                                  identifier

  sender_name       VARCHAR(100)                                                NOT NULL          Sender name

  receiver_name     VARCHAR(100)                                                NOT NULL          Receiver name

  origin            VARCHAR(100)                                                NOT NULL          Parcel origin

  destination       VARCHAR(100)                                                NOT NULL          Parcel
                                                                                                  destination

  route_id          INT                                                         NOT NULL, FK →    Configured route
                                                                                routes.route_id   

  weight            DECIMAL(10,2)                                               NOT NULL, \> 0    Parcel weight in
                                                                                                  kg

  urgency           ENUM('Normal','Urgent')                                     NOT NULL, DEFAULT User-declared
                                                                                'Normal'          urgency

  arrival_time      DATETIME                                                    NOT NULL          Time parcel
                                                                                                  enters warehouse

  deadline          DATETIME                                                    NULL              Required delivery
                                                                                                  time; NULL means
                                                                                                  no explicit
                                                                                                  deadline

  max_wait_hours    INT                                                         NOT NULL, DEFAULT Maximum target
                                                                                48, \> 0          warehouse wait

  status            ENUM('Registered','Waiting for Sorting','Sorted','Awaiting  NOT NULL, DEFAULT Current parcel
                    Dispatch','Batched','Dispatched','Delivered','Exception')   'Registered'      state
  -----------------------------------------------------------------------------------------------------------------

Recommended indexes: - UNIQUE index on `tracking_id`. - Composite index
on `(route_id, status, arrival_time)`. - Index on `deadline`. - Index on
`status`.

Rules: - `deadline` may be NULL. - If present, deadline must not be
earlier than arrival_time. - `max_wait_hours` is measured from
`arrival_time` for the initial version. If business rules later require
time spent waiting only while physically in the warehouse, store status
interval timestamps and calculate accordingly. - `origin` and
`destination` must match the referenced route. - A parcel with weight
greater than every truck's capacity on its route must be rejected or
marked Exception with a clear reason; it must not enter normal
scheduling. - Do not overwrite parcel identity or arrival time when a
parcel is rescheduled.

## 4.7 `destination_groups`

**Purpose:** Stores a persistent group definition for each route.

  -------------------------------------------------------------------------
  Field             SQL type          Constraints         Description
  ----------------- ----------------- ------------------- -----------------
  group_id          INT               PK, AUTO_INCREMENT  Group ID

  route_id          INT               NOT NULL, UNIQUE,   One group per
                                      FK →                route
                                      routes.route_id     

  group_name        VARCHAR(100)      NOT NULL            Display name,
                                                          e.g. Ahmedabad →
                                                          Mumbai

  created_at        DATETIME          DEFAULT             Creation
                                      CURRENT_TIMESTAMP   timestamp
  -------------------------------------------------------------------------

Rules: - One route has at most one persistent destination group. -
Actual waiting parcel membership is determined by parcel route and
eligible status. - The JavaScript linked list is rebuilt from MySQL
records when needed. - Avoid storing parcel IDs as a comma-separated
string.

## 4.8 `batches`

**Purpose:** Represents one truck's parcel load for one concrete
departure.

  ------------------------------------------------------------------------------------------------------------------------------
  Field                 SQL type                                                       Constraints             Description
  --------------------- -------------------------------------------------------------- ----------------------- -----------------
  batch_id              INT                                                            PK, AUTO_INCREMENT      Internal batch ID

  batch_code            VARCHAR(30)                                                    NOT NULL, UNIQUE        Human-readable
                                                                                                               batch code

  truck_id              INT                                                            NOT NULL, FK →          Assigned truck
                                                                                       trucks.truck_id         

  route_id              INT                                                            NOT NULL, FK →          Batch route
                                                                                       routes.route_id         

  schedule_id           INT                                                            NOT NULL, FK →          Recurring
                                                                                       schedules.schedule_id   schedule used

  scheduled_departure   DATETIME                                                       NOT NULL                Concrete planned
                                                                                                               departure

  total_weight          DECIMAL(10,2)                                                  NOT NULL, DEFAULT 0     Sum of assigned
                                                                                                               parcel weights

  parcel_count          INT                                                            NOT NULL, DEFAULT 0     Number of
                                                                                                               assigned parcels

  batch_status          ENUM('Generated','Ready','Dispatched','Delayed','Cancelled')   NOT NULL, DEFAULT       Batch state
                                                                                       'Generated'             

  created_at            DATETIME                                                       DEFAULT                 Batch creation
                                                                                       CURRENT_TIMESTAMP       time
  ------------------------------------------------------------------------------------------------------------------------------

Constraints/indexes: - `UNIQUE(truck_id, scheduled_departure)` for the
initial one-batch-per-truck-per-departure model. - Index on
`(route_id, scheduled_departure, batch_status)`. - `total_weight >= 0`,
`parcel_count >= 0`.

Rules: - `total_weight` must equal the sum of assigned parcel weights. -
`total_weight` must not exceed truck capacity. - Batch route, truck
route, and schedule truck must agree. - If a batch is generated before
departure, it may move from Generated to Ready after checks. - A batch
must not be edited after dispatch except through an explicit correction
workflow.

## 4.9 `batch_parcels`

**Purpose:** Junction table linking parcels to batches.

  -------------------------------------------------------------------------
  Field             SQL type          Constraints         Description
  ----------------- ----------------- ------------------- -----------------
  batch_parcel_id   INT               PK, AUTO_INCREMENT  Assignment row ID

  batch_id          INT               NOT NULL, FK →      Batch
                                      batches.batch_id    

  parcel_id         INT               NOT NULL, UNIQUE,   Assigned parcel
                                      FK →                
                                      parcels.parcel_id   
  -------------------------------------------------------------------------

Rules: - A parcel can appear in only one batch in the initial design.
The unique constraint on `parcel_id` enforces this. - If future
functionality allows a parcel to be removed from a cancelled batch and
rebatched, the existing assignment row should be deleted only as part of
a controlled cancellation transaction, or replace this design with
assignment history and an `is_active` field. - Do not assign a parcel
whose status is already Batched, Dispatched, Delivered, or Exception. -
Insert batch and assignment rows in one transaction.

## 4.10 `dispatch_history`

**Purpose:** Stores the actual departure event for a batch.

  -----------------------------------------------------------------------------------------
  Field                 SQL type                       Constraints        Description
  --------------------- ------------------------------ ------------------ -----------------
  dispatch_id           INT                            PK, AUTO_INCREMENT Dispatch event ID

  batch_id              INT                            NOT NULL, UNIQUE,  Dispatched batch
                                                       FK →               
                                                       batches.batch_id   

  scheduled_departure   DATETIME                       NOT NULL           Planned departure

  actual_departure      DATETIME                       NULL               Actual simulated
                                                                          departure time

  dispatch_status       ENUM('Dispatched','Delayed')   NOT NULL, DEFAULT  Departure outcome
                                                       'Delayed'          
  -----------------------------------------------------------------------------------------

Rules: - A dispatch event is created when a batch is processed at its
scheduled departure time. - `actual_departure` is NULL while not
dispatched. - A batch can have only one successful dispatch event in the
initial model. - If a batch is delayed, retain the reason in a future
`remarks` field or event log; do not silently alter the scheduled
departure.

## 4.11 `parcel_status_history`

**Purpose:** Audit every status transition for a parcel.

  -------------------------------------------------------------------------
  Field             SQL type          Constraints         Description
  ----------------- ----------------- ------------------- -----------------
  history_id        INT               PK, AUTO_INCREMENT  History row ID

  parcel_id         INT               NOT NULL, FK →      Parcel
                                      parcels.parcel_id   

  previous_status   VARCHAR(30)       NULL for initial    Previous state
                                      status              

  new_status        VARCHAR(30)       NOT NULL            New state

  changed_at        DATETIME          DEFAULT             Change timestamp
                                      CURRENT_TIMESTAMP   

  remarks           VARCHAR(255)      NULL                Reason or
                                                          additional
                                                          context
  -------------------------------------------------------------------------

Rules: - Insert a history row whenever `parcels.status` changes. - The
first history row has `previous_status = NULL` and
`new_status = 'Registered'`. - Update current parcel status and insert
history in one database transaction. - Status history is append-only in
normal application use.

------------------------------------------------------------------------

# 5. Module-by-module implementation contract

Each module section defines its purpose, inputs, processing, outputs,
database access, runtime data structure, and failure conditions.

## Module 1 --- Parcel Registration

### Purpose

Accept parcel details from the React UI and create a parcel record.

### UI input fields

-   Sender name
-   Receiver name
-   Origin
-   Destination
-   Weight in kg
-   Urgency (`Normal` or `Urgent`)
-   Optional delivery deadline
-   Maximum waiting period in hours

### Backend input

``` json
{
  "sender_name": "Aarav Shah",
  "receiver_name": "Meera Patel",
  "origin": "Ahmedabad",
  "destination": "Mumbai",
  "weight": 3.5,
  "urgency": "Urgent",
  "deadline": "2026-11-03T18:00:00",
  "max_wait_hours": 48
}
```

### Processing

1.  Receive request.
2.  Validate required fields are present at the API boundary.
3.  Generate a unique tracking ID, e.g. `PCL-2026-000001`. Use a
    collision-safe generation strategy; do not rely on an unchecked
    count.
4.  Set `arrival_time` from the simulation clock, not blindly from the
    browser.
5.  Set initial status to `Registered`.
6.  Pass the data to Module 2 for full validation and route lookup.
7.  Persist only after validation succeeds.

### Database

-   Read: `routes`
-   Insert: `parcels`
-   Insert: `parcel_status_history`

### Output to Module 2

A normalized parcel creation object containing: - tracking ID -
sender/receiver - origin/destination - weight - urgency - arrival time -
optional deadline - max wait hours - route ID after route lookup

### Success response

``` json
{
  "success": true,
  "message": "Parcel registered successfully",
  "data": {
    "parcel_id": 1,
    "tracking_id": "PCL-2026-000001",
    "status": "Registered"
  }
}
```

### Failure cases

-   Missing sender or receiver.
-   Unknown origin/destination route.
-   Invalid weight.
-   Deadline earlier than arrival.
-   Invalid urgency.
-   Invalid maximum waiting duration.
-   Tracking ID collision.

No queue insertion occurs if registration fails.

## Module 2 --- Parcel Validation

### Purpose

Ensure a parcel is valid and can be processed by the configured system.

### Input

Normalized parcel data from Module 1.

### Processing

1.  Confirm sender and receiver names are non-empty.
2.  Confirm origin and destination are non-empty and different.
3.  Find exact directed route `(origin, destination)` in `routes`.
4.  Confirm weight is greater than zero.
5.  Confirm urgency is one of the allowed values.
6.  If deadline exists, ensure it is later than or equal to arrival
    time.
7.  Confirm `max_wait_hours > 0`.
8.  Confirm at least one active truck/schedule can serve the route, or
    return a clear "route currently has no service" result. The product
    may choose to accept parcels for a configured route even if its next
    truck is temporarily unavailable; this must be a deliberate policy.
9.  Confirm the parcel does not exceed the maximum usable truck capacity
    on the route. If it does, reject or flag as Exception according to
    the chosen business rule.

### Database

-   Read: `routes`, `trucks`, `schedules`
-   Insert/update: `parcels` only after validation succeeds
-   Insert: `parcel_status_history` for initial Registered state

### Output to Module 3

``` json
{
  "parcel_id": 1,
  "tracking_id": "PCL-2026-000001",
  "route_id": 1,
  "origin": "Ahmedabad",
  "destination": "Mumbai",
  "weight": 3.5,
  "status": "Registered",
  "validation_status": "VALID"
}
```

### Failure cases

Return structured validation errors. Do not enqueue or sort invalid
parcels.

## Module 3 --- Incoming Queue Management

### Purpose

Hold newly registered parcels in FIFO order until destination sorting
processes them.

### Data structure

Custom Queue implemented in JavaScript. Do not use a plain array with
repeated `shift()` for the core queue if the assignment is meant to
demonstrate a queue implementation. Use a head/tail structure or linked
nodes.

### Input

Validated parcel reference: - `parcel_id` - `tracking_id` -
`arrival_time` - `route_id`

### Processing

1.  Enqueue parcel ID at the rear.
2.  Dequeue from the front when sorting begins.
3.  Retrieve the authoritative parcel record from MySQL by ID.
4.  Confirm parcel status is `Registered` or `Waiting for Sorting`.
5.  Change status to `Waiting for Sorting` when it enters the queue,
    then to `Sorted` when Module 4 successfully accepts it.
6.  Record status transitions in `parcel_status_history`.
7.  On server restart, rebuild the queue from parcels whose statuses
    indicate they are awaiting sorting, ordered by arrival time and
    parcel ID.

### Database

-   Read: `parcels`
-   Update: `parcels.status`
-   Insert: `parcel_status_history`

### Output to Module 4

Parcel reference containing `parcel_id` and route details. The queue
should pass IDs/references, not independent copies that can become
stale.

### Failure cases

-   Parcel not found.
-   Parcel already sorted/batched/dispatched.
-   Duplicate enqueue.
-   Database update failure.

If persistence fails during dequeue/transition, do not permanently lose
the parcel from the queue. Use a safe processing pattern: peek,
process/commit state transition, then remove from the in-memory queue.

## Module 4 --- Destination Sorting

### Purpose

Group parcels by route before scheduling.

### Data structure

Custom Linked List: - One group/list per route. - Nodes contain parcel
IDs/references. - Each route group has head and tail pointers. -
Maintain a route ID → group lookup for finding the correct group. This
lookup may be a JavaScript `Map`; it is an implementation index, not a
replacement for the linked-list group structure.

### Input

Parcel reference from Module 3.

### Processing

1.  Read parcel's `route_id`.
2.  Find the route group.
3.  If no runtime group exists, create one.
4.  Append the parcel node to the route group's linked list.
5.  Update parcel status to `Sorted`, then `Awaiting Dispatch` when it
    is available for scheduling.
6.  Ensure the parcel is not already present.
7.  Rebuild route groups from MySQL on server startup using parcels in
    `Sorted` or `Awaiting Dispatch` status that are not assigned to an
    active batch.

### Database

-   Read: `parcels`, `routes`, `destination_groups`
-   Update: `parcels.status`
-   Insert status history rows
-   `destination_groups` is a persistent route-group definition; do not
    insert a new group for every parcel.

### Output to Module 5/6

For each route: - route ID - list of eligible parcel IDs - parcel
attributes required for scheduling (weight, urgency, arrival time,
deadline, max wait) - group size

### Failure cases

-   Missing route.
-   Parcel already grouped/assigned.
-   Duplicate node.
-   Runtime group inconsistency.

## Module 5 --- Route & Truck Management

### Purpose

Provide the scheduler with route properties and valid upcoming truck
departures.

### Inputs

Admin/operator configuration: - route origin/destination - estimated
travel time - processing buffer - truck number - truck weight capacity -
recurring departure time - operating weekdays - active/inactive schedule
status

### Processing

1.  Create/update route.
2.  Create/update truck assigned to route.
3.  Create/update recurring schedule.
4.  Validate positive travel time, buffer, capacity, and valid weekdays.
5.  Given simulation time, calculate upcoming departure instances.
6.  Check truck availability and overlapping trips.
7.  Return valid truck departure candidates for each route.

### Database

-   CRUD: `routes`, `trucks`, `schedules`
-   Read: existing batches and dispatch records when checking truck
    availability.

### Output to Module 6

``` json
{
  "route_id": 1,
  "origin": "Ahmedabad",
  "destination": "Mumbai",
  "estimated_travel_hours": 6,
  "processing_buffer_hours": 1,
  "truck": {
    "truck_id": 1,
    "truck_number": "GJ01AB1234",
    "capacity": 500,
    "availability_status": "Available"
  },
  "departure": {
    "schedule_id": 1,
    "scheduled_departure": "2026-11-02T07:00:00"
  }
}
```

### Failure cases

-   Truck route does not match batch route.
-   Truck in Maintenance.
-   Truck unavailable due to an overlapping trip.
-   Inactive schedule.
-   No upcoming departure.

## Module 6 --- Scheduling Engine

### Purpose

Choose parcels for a specific route/truck/departure while respecting
deadline feasibility and truck capacity.

This module is the core algorithm and must be independently testable.

### Inputs

1.  Route-wise waiting parcels from Module 4.
2.  Candidate truck departure from Module 5.
3.  Current simulation time.
4.  Truck capacity in kg.
5.  Route travel duration.
6.  Processing/safety buffer.
7.  Scheduling policy configuration.

### Required per-parcel calculations

For parcel `p`:

``` text
latest_safe_departure =
    deadline
    - estimated_travel_duration
    - processing_buffer
```

This is the latest time the parcel may leave the origin under the simple
model.

Also calculate:

``` text
waiting_duration = current_time - arrival_time

maximum_wait_time =
    arrival_time + max_wait_hours
```

For a parcel without a deadline, `maximum_wait_time` acts as the
no-deadline waiting target.

### Departure feasibility

For a candidate departure `D`:

``` text
estimated_delivery_time =
    D + estimated_travel_duration + processing_buffer
```

A parcel with a deadline is feasible on that departure if:

``` text
estimated_delivery_time <= deadline
```

A parcel is at risk if no remaining scheduled departure with available
capacity can meet its deadline.

The scheduler must examine the next feasible departure, not merely
compare with the next departure. For example, if today's truck is full,
check whether tomorrow's truck can still meet the deadline.

### Deadline-critical selection

A parcel is mandatory for the current departure when: - it can meet its
deadline on the current departure, and - delaying it to the next
feasible departure would miss its deadline; or - its latest safe
departure is at or before the current departure and it has not already
missed the deadline.

If it has already missed its deadline before the current departure, flag
it as overdue/Exception or at risk. Do not label it as successfully
deadline-feasible.

### Priority score

Use a configurable initial weighted score:

``` text
priority_score =
    (urgency_score * 30)
  + (deadline_pressure_score * 35)
  + (travel_time_score * 15)
  + (waiting_time_score * 20)
```

Each normalized factor must be between 0 and 1. The maximum score is
100.

Recommended initial factor definitions: - `urgency_score`: Urgent = 1.0,
Normal = 0.5. - `deadline_pressure_score`: higher as remaining slack
decreases. Define and document a bounded formula; clamp to \[0,1\].
No-deadline parcels use 0 for this factor. - `travel_time_score`:
normalize route travel time against a configured maximum or a documented
reference range. Do not let longer travel time override a hard
deadline. - `waiting_time_score`:
`min(waiting_duration / max_wait_hours, 1)`. For deadline parcels, this
still measures warehouse wait; for no-deadline parcels, it reaches 1 at
the maximum waiting target.

The score is a ranking mechanism for non-mandatory eligible parcels. It
must never override hard deadline feasibility.

### Scheduling order

1.  Select the route's waiting parcels.
2.  Exclude parcels already assigned to a non-cancelled batch or already
    dispatched/delivered.
3.  Compute delivery feasibility for the current departure.
4.  Identify deadline-critical parcels.
5.  Sort deadline-critical parcels by earliest latest-safe-departure,
    then highest priority score, then earliest arrival, then parcel ID.
6.  Reserve capacity for deadline-critical parcels first.
7.  If mandatory parcels exceed truck capacity, select the feasible
    subset using the same ordering and produce a capacity-conflict list
    for unselected parcels.
8.  Rank remaining eligible parcels using a Priority Queue (max heap) by
    priority score, with deterministic tie-breakers:
    -   earlier deadline first (NULL deadlines last)
    -   longer waiting duration first
    -   earlier arrival first
    -   lower parcel ID first
9.  Add parcels while remaining truck weight capacity permits.
10. For no-deadline parcels, prioritize those nearing/exceeding maximum
    wait.
11. Check whether any unselected parcel can still meet its deadline on a
    later scheduled departure. If not, flag it as at risk.
12. Return a scheduling plan; do not write batch/parcel assignments in
    this module.

### Important capacity rule

Capacity is measured in kilograms. Do not use parcel count as the
capacity constraint. A truck can carry a maximum weight, and optional
future rules may add maximum parcel count or volume.

A parcel whose individual weight exceeds truck capacity is not eligible
for that truck and must be flagged for a compatible truck or manual
exception.

### Output to Module 7

``` json
{
  "route_id": 1,
  "truck_id": 1,
  "schedule_id": 1,
  "scheduled_departure": "2026-11-02T07:00:00",
  "capacity_kg": 500,
  "selected_parcels": [
    {
      "parcel_id": 1,
      "priority_score": 91.5,
      "selection_reason": "Deadline-critical"
    },
    {
      "parcel_id": 2,
      "priority_score": 72.0,
      "selection_reason": "Highest remaining priority"
    }
  ],
  "total_weight_kg": 420,
  "remaining_capacity_kg": 80,
  "deferred_parcels": [
    {
      "parcel_id": 3,
      "reason": "Can safely travel on next departure"
    }
  ],
  "deadline_conflicts": [],
  "capacity_conflict": false
}
```

### Failure cases

-   No route group.
-   No active truck schedule.
-   No available truck.
-   No eligible parcels.
-   All parcels exceed truck capacity.
-   Mandatory parcels exceed available capacity.
-   Missing/invalid simulation time.
-   Duplicate or stale parcel state.

The engine should return a structured plan and warnings, not mutate
database state.

## Module 7 --- Batch Generation

### Purpose

Persist the scheduler's selected parcel list as a batch and atomically
assign parcels.

### Input

Scheduling plan from Module 6.

### Processing

1.  Begin MySQL transaction.
2.  Lock/recheck the selected parcel rows (`SELECT ... FOR UPDATE`).
3.  Recheck each parcel is still eligible and unassigned.
4.  Recheck route IDs match.
5.  Recheck truck and schedule are active and compatible.
6.  Recalculate total weight from database parcel records.
7.  Confirm total weight \<= truck capacity.
8.  Confirm no existing batch for the same truck and departure.
9.  Insert `batches` row with generated unique batch code.
10. Insert one `batch_parcels` row per selected parcel.
11. Update selected parcel statuses to `Batched`.
12. Insert status history rows.
13. Commit transaction.
14. If any step fails, roll back all changes.

### Database

-   Insert: `batches`
-   Insert: `batch_parcels`
-   Update: `parcels`
-   Insert: `parcel_status_history`
-   Read/lock: `parcels`, `trucks`, `schedules`, `routes`, `batches`

### Output to Module 8

``` json
{
  "batch_id": 1,
  "batch_code": "BATCH-2026-000001",
  "truck_id": 1,
  "route_id": 1,
  "schedule_id": 1,
  "scheduled_departure": "2026-11-02T07:00:00",
  "parcel_ids": [1, 2],
  "total_weight": 420,
  "parcel_count": 2,
  "batch_status": "Ready"
}
```

### Failure cases

-   Parcel was assigned by another concurrent operation.
-   Capacity changed or is exceeded.
-   Truck/schedule became unavailable.
-   Batch already exists for departure.
-   Any database operation fails.

## Module 8 --- Dispatch Management

### Purpose

Process batches at their scheduled departure time.

### Input

-   Simulation clock time.
-   Batch ID or due-batch list.
-   Truck status.
-   Batch status.
-   Assigned parcel IDs.

### Processing

1.  Find batches where `scheduled_departure <= simulation_time` and
    status is Ready/Generated.
2.  Validate batch has at least one parcel.
3.  Validate truck is operational and available for this departure.
4.  Validate assigned parcels are still Batched and belong to this
    batch.
5.  Set `actual_departure` to simulation time.
6.  Insert dispatch history.
7.  Set batch status to Dispatched.
8.  Set all assigned parcel statuses to Dispatched.
9.  Insert parcel status history rows.
10. Update truck availability to In Transit.
11. Commit all changes in one transaction.

If a batch cannot depart, mark/retain a clear delayed state and reason.
Do not mark parcels Dispatched.

### Database

-   Read/lock: `batches`, `batch_parcels`, `parcels`, `trucks`
-   Insert: `dispatch_history`
-   Update: `batches`, `parcels`, `trucks`
-   Insert: `parcel_status_history`

### Output to Module 9

Dispatch event and updated parcel records.

## Module 9 --- Tracking & Status Management

### Purpose

Find a parcel using its tracking ID and display its current state and
history.

### Input

``` json
{
  "tracking_id": "PCL-2026-000001"
}
```

### Processing

1.  Look up parcel in the custom Hash Table if it is populated and
    current.
2.  If not found in cache, query MySQL by unique tracking ID.
3.  Load associated batch, truck, route, dispatch, and status history
    information.
4.  Return current status and chronological history.
5.  The database remains authoritative; cache misses/stale entries must
    fall back to MySQL.

### Database

-   Read: `parcels`, `routes`, `batch_parcels`, `batches`, `trucks`,
    `dispatch_history`, `parcel_status_history`

### Output

``` json
{
  "tracking_id": "PCL-2026-000001",
  "current_status": "Dispatched",
  "origin": "Ahmedabad",
  "destination": "Mumbai",
  "urgency": "Urgent",
  "deadline": "2026-11-03T18:00:00",
  "batch": {
    "batch_code": "BATCH-2026-000001",
    "truck_number": "GJ01AB1234",
    "scheduled_departure": "2026-11-02T07:00:00",
    "actual_departure": "2026-11-02T07:00:00"
  },
  "history": [
    {
      "previous_status": null,
      "new_status": "Registered",
      "changed_at": "2026-11-01T10:00:00"
    },
    {
      "previous_status": "Registered",
      "new_status": "Waiting for Sorting",
      "changed_at": "2026-11-01T10:01:00"
    }
  ]
}
```

### Failure cases

-   Unknown tracking ID.
-   Parcel record exists but associated batch/dispatch record is
    unavailable.
-   Inconsistent current status and history (return a safe error and log
    for investigation).

------------------------------------------------------------------------

# 6. Parcel lifecycle and state transitions

## 6.1 Allowed status sequence

``` text
Registered
    |
    v
Waiting for Sorting
    |
    v
Sorted
    |
    v
Awaiting Dispatch
    |
    v
Batched
    |
    v
Dispatched
    |
    v
Delivered
```

Possible exception paths: - A parcel may move to `Exception` if route,
weight, data, or deadline handling requires manual intervention. - A
parcel in a batch that is cancelled may return to `Awaiting Dispatch`,
but only through an explicit batch-cancellation transaction. - A delayed
batch does not mean its parcels have been dispatched. - A parcel must
not move from Dispatched back to Batched through the normal workflow.

## 6.2 Status transition contract

  ------------------------------------------------------------------------------
  Previous status   New status        Trigger                  Required action
  ----------------- ----------------- ------------------------ -----------------
  NULL              Registered        Parcel creation          Insert parcel +
                                                               initial history

  Registered        Waiting for       Accepted into queue      Update parcel +
                    Sorting                                    history

  Waiting for       Sorted            Added to route group     Update parcel +
  Sorting                                                      history

  Sorted            Awaiting Dispatch Available to scheduler   Update parcel +
                                                               history

  Awaiting Dispatch Batched           Batch transaction        Update parcel +
                                      commits                  history

  Batched           Dispatched        Truck departs            Update parcel +
                                                               history

  Dispatched        Delivered         Delivery completion is   Update parcel +
                                      simulated/recorded       history

  Any eligible      Exception         Validation/operational   Record reason in
  pre-dispatch                        failure                  history
  state                                                        
  ------------------------------------------------------------------------------

The backend must enforce allowed transitions in one shared
status-management service. Frontend code must not directly set arbitrary
parcel statuses.

------------------------------------------------------------------------

# 7. Runtime data structures in JavaScript

The data structures are used for in-memory processing. They do not
replace MySQL.

## 7.1 Queue --- incoming parcels

-   Implement a custom FIFO Queue.
-   Enqueue validated parcel IDs.
-   Dequeue parcel IDs when destination sorting processes them.
-   Rebuild from MySQL after server restart using parcels awaiting
    sorting.
-   Prevent duplicate IDs.

Suggested interface:

``` js
class ParcelQueue {
  enqueue(parcelId) {}
  dequeue() {}
  peek() {}
  isEmpty() {}
  size() {}
}
```

## 7.2 Linked List --- destination groups

-   Maintain one linked list per route.
-   Each node contains a parcel ID/reference.
-   Maintain head and tail pointers.
-   Append newly sorted parcels.
-   Remove a parcel when it is assigned to a batch or otherwise leaves
    the waiting group.
-   Rebuild from eligible MySQL parcel records after restart.

Suggested interface:

``` js
class DestinationParcelList {
  append(parcelId) {}
  remove(parcelId) {}
  find(parcelId) {}
  toArray() {}
  size() {}
}
```

## 7.3 Priority Queue --- scheduling

-   Implement a binary max heap.
-   Higher priority score is extracted first.
-   Use deterministic tie-breakers.
-   Build a fresh heap for each route/departure scheduling run, or clear
    it after the run.
-   Deadline-critical reservation is performed before optional
    score-based ranking.

Suggested interface:

``` js
class ParcelPriorityQueue {
  insert(parcelWithScore) {}
  extractMax() {}
  peek() {}
  isEmpty() {}
  size() {}
}
```

## 7.4 Hash Table --- parcel tracking

-   Implement a custom hash table keyed by tracking ID.
-   Store parcel ID or a small current parcel reference.
-   Handle collisions using separate chaining or open addressing.
-   Treat MySQL as authoritative.
-   Invalidate/update cache entries whenever parcel state changes.
-   Rebuild cache on startup or populate lazily.

Suggested interface:

``` js
class ParcelHashTable {
  set(trackingId, parcelReference) {}
  get(trackingId) {}
  remove(trackingId) {}
  contains(trackingId) {}
}
```

------------------------------------------------------------------------

# 8. API contract between React and Express

Suggested REST endpoints. Names can be adjusted during implementation,
but preserve the responsibilities.

  -------------------------------------------------------------------------------------------
  Method            Endpoint                      Module                    Purpose
  ----------------- ----------------------------- ------------------------- -----------------
  POST              `/api/parcels`                Registration/Validation   Register parcel

  GET               `/api/parcels`                Tracking                  List/search
                                                                            parcels with
                                                                            filters

  GET               `/api/parcels/:trackingId`    Tracking                  Track parcel

  GET               `/api/routes`                 Route Management          List routes

  POST              `/api/routes`                 Route Management          Create route

  PUT               `/api/routes/:id`             Route Management          Update route

  GET               `/api/trucks`                 Route Management          List trucks

  POST              `/api/trucks`                 Route Management          Create truck

  GET               `/api/schedules`              Route Management          List schedules

  POST              `/api/schedules`              Route Management          Create schedule

  POST              `/api/sorting/process`        Incoming Queue/Sorting    Process incoming
                                                                            queue

  GET               `/api/destination-groups`     Destination Sorting       View route groups

  POST              `/api/scheduler/run`          Scheduling                Generate
                                                                            scheduling
                                                                            plan/batches

  GET               `/api/batches`                Batch Generation          List batches

  GET               `/api/batches/:id`            Batch Generation          View batch
                                                                            details

  POST              `/api/dispatch/process-due`   Dispatch                  Process batches
                                                                            due at simulation
                                                                            time

  POST              `/api/simulation/clock`       Simulation control        Advance/set
                                                                            simulation clock

  GET               `/api/simulation/clock`       Simulation control        Read current
                                                                            simulation time
  -------------------------------------------------------------------------------------------

For the first implementation, a single scheduler endpoint may run the
plan and batch-generation transaction together. Keep the internal
scheduling algorithm pure (input → plan) so it can be tested separately.

All API responses should use a consistent shape:

``` json
{
  "success": true,
  "message": "Operation completed",
  "data": {}
}
```

Validation errors:

``` json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "weight",
      "message": "Weight must be greater than zero"
    }
  ]
}
```

------------------------------------------------------------------------

# 9. Scheduling examples and edge cases

The coding agent must implement and test these scenarios.

## Scenario A --- Parcel can travel on current truck

-   Truck departure: Monday 7:00 AM.
-   Travel time: 6 hours.
-   Buffer: 1 hour.
-   Parcel deadline: Monday 6:00 PM.
-   Estimated arrival: Monday 2:00 PM.

Expected: Parcel is feasible on Monday's truck.

## Scenario B --- Parcel can wait for tomorrow

-   Current departure: Monday 7:00 AM.
-   Next departure: Tuesday 7:00 AM.
-   Travel time: 4 hours.
-   Buffer: 1 hour.
-   Deadline: Wednesday 6:00 PM.

Expected: Parcel can safely wait until Tuesday if capacity is needed for
more urgent parcels.

## Scenario C --- Parcel must leave now

-   Current departure: Monday 7:00 AM.
-   Next departure: Tuesday 7:00 AM.
-   Travel time: 6 hours.
-   Buffer: 1 hour.
-   Deadline: Monday 6:00 PM.

Expected: Current departure is required. If no capacity is available,
flag a deadline/capacity conflict.

## Scenario D --- No deadline, spare capacity

-   Parcel has no deadline.
-   Waiting duration is 20 hours.
-   Maximum waiting period is 48 hours.
-   Truck has spare weight capacity.

Expected: Parcel is eligible to fill spare capacity according to its
waiting-time score.

## Scenario E --- No deadline, maximum wait reached

-   Parcel has no deadline.
-   Waiting duration is 48 hours.
-   Maximum waiting period is 48 hours.
-   Truck is available but capacity is limited.

Expected: Parcel receives maximum waiting-time priority. If it still
cannot be assigned, flag a maximum-wait/capacity conflict. Do not
silently postpone it.

## Scenario F --- Truck capacity exceeded

-   Truck capacity: 500 kg.
-   Selected parcels total: 530 kg.

Expected: Batch creation is rejected or scheduler selects a valid subset
and flags deferred parcels. Never create an overweight batch.

## Scenario G --- Parcel heavier than any truck on route

-   Parcel weight: 700 kg.
-   Largest compatible truck: 500 kg.

Expected: Parcel is rejected at validation or placed into Exception with
a clear reason. It must not enter an impossible normal scheduling loop.

## Scenario H --- Repeated scheduling request

Run the scheduler twice for the same route and departure without
changing the data.

Expected: No duplicate batch, no duplicate parcel assignment, and no
duplicate status transitions.

## Scenario I --- Concurrent batch generation

Two requests attempt to assign the same parcel to different batches.

Expected: Database transaction/locking and unique constraints ensure
only one assignment succeeds.

## Scenario J --- Batch delayed at departure

A batch is Ready but its truck is in Maintenance.

Expected: Batch is not dispatched. Record delayed state/reason. Parcels
remain associated with the batch until a controlled
cancellation/reassignment or rescheduling operation occurs.

------------------------------------------------------------------------

# 10. Business rules and unresolved policy decisions

The coding agent must not invent behavior for unspecified cases. Use the
defaults below unless the project owner changes them.

  -----------------------------------------------------------------------
  Topic                               Initial rule
  ----------------------------------- -----------------------------------
  Truck capacity                      Weight in kg

  Departure policy                    Truck departs at scheduled time,
                                      even if not full

  Route grouping                      Exact origin + destination

  Deadline calculation                Deadline minus travel duration
                                      minus processing buffer

  Priority                            Deadline-critical first, then
                                      weighted score

  No-deadline parcels                 Can fill spare capacity; maximum
                                      wait increases priority

  Maximum wait exceeded               Flag conflict; do not promise
                                      dispatch if capacity is unavailable

  Deadline conflict                   Explicit warning/exception

  Simulation clock                    Application-controlled time

  Dispatch                            Only when simulation time reaches
                                      departure

  Batch creation                      Atomic transaction

  Parcel assignment                   At most one active batch per parcel

  Tracking                            Tracking ID lookup, current status
                                      plus history

  Analytics/reporting                 Not included as a separate module
  -----------------------------------------------------------------------

### Important clarification about deadlines

The initial model assumes that the delivery deadline means the parcel
must arrive at the destination by that time. Therefore:

``` text
estimated_delivery_time =
    scheduled_departure
    + estimated_travel_hours
    + processing_buffer_hours
```

If the processing buffer is actually warehouse loading time rather than
destination handling time, its placement in this formula must be
adjusted. Document one interpretation and use it consistently.

### Important clarification about urgency

`urgency` is a sender/operator classification (`Urgent` or `Normal`). It
is not the same as deadline pressure. A Normal parcel with a very close
deadline may be more time-critical than an Urgent parcel with several
days remaining. The hard deadline feasibility calculation takes
precedence over the score.

------------------------------------------------------------------------

# 11. Suggested backend project structure

``` text
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── database.js
│   │   └── simulationClock.js
│   ├── modules/
│   │   ├── parcels/
│   │   │   ├── parcel.routes.js
│   │   │   ├── parcel.controller.js
│   │   │   ├── parcel.service.js
│   │   │   └── parcel.repository.js
│   │   ├── validation/
│   │   ├── incomingQueue/
│   │   ├── destinationSorting/
│   │   ├── routeManagement/
│   │   ├── scheduling/
│   │   │   ├── deadlineAnalyzer.js
│   │   │   ├── priorityCalculator.js
│   │   │   ├── scheduler.js
│   │   │   └── scheduler.service.js
│   │   ├── batches/
│   │   ├── dispatch/
│   │   └── tracking/
│   ├── dataStructures/
│   │   ├── Queue.js
│   │   ├── LinkedList.js
│   │   ├── PriorityQueue.js
│   │   └── HashTable.js
│   ├── shared/
│   │   ├── statusTransitions.js
│   │   ├── errors.js
│   │   └── response.js
│   └── routes/
│       └── index.js
├── database/
│   ├── schema.sql
│   └── seed.sql
├── tests/
│   ├── dataStructures/
│   ├── modules/
│   └── integration/
├── package.json
└── README.md
```

Frontend:

``` text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Parcels.jsx
│   │   ├── RegisterParcel.jsx
│   │   ├── DestinationGroups.jsx
│   │   ├── Routes.jsx
│   │   ├── Trucks.jsx
│   │   ├── Schedules.jsx
│   │   ├── Scheduler.jsx
│   │   ├── Batches.jsx
│   │   ├── Dispatch.jsx
│   │   └── Tracking.jsx
│   ├── services/
│   │   └── api.js
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

------------------------------------------------------------------------

# 12. Development sequence

Build and verify modules in this order:

1.  Create MySQL schema; seed the single operator account, routes,
    trucks, and schedules.
2.  Implement operator login, JWT authentication middleware, and
    protected frontend routes.
3.  Implement parcel registration and validation.
4.  Implement custom Queue and test FIFO behavior.
5.  Implement destination Linked List and route grouping.
6.  Implement route/truck/schedule management.
7.  Implement deadline analyzer as a pure, unit-testable function.
8.  Implement priority calculator and binary max heap.
9.  Implement scheduler selection and capacity conflict detection.
10. Implement transactional batch generation.
11. Implement simulated clock and dispatch processing.
12. Implement custom Hash Table and tracking lookup.
13. Integrate the remaining React UI with authenticated backend APIs.
14. Run all acceptance scenarios above.

Do not start by building the dashboard alone. The database, parcel
lifecycle, and scheduling behavior should be verified first, then the UI
can consume stable APIs.

------------------------------------------------------------------------

# 13. Definition of done

The project is considered functionally complete when:

-   [ ] The seeded single operator can log in with username and password.
-   [ ] Passwords are stored as secure hashes, never plaintext.
-   [ ] A valid JWT is required for all operational API endpoints.
-   [ ] Unauthenticated users are redirected to the login page.
-   [ ] Logout clears the client token and returns to login.
-   [ ] Public registration, multiple users, and role management are absent.
-   [ ] A parcel can be registered with or without a deadline.
-   [ ] Invalid parcels are rejected with useful messages.
-   [ ] Incoming parcels are processed FIFO.
-   [ ] Parcels are grouped by route.
-   [ ] Routes, trucks, and recurring schedules can be configured.
-   [ ] The simulation clock can be advanced.
-   [ ] The scheduler calculates deadline feasibility.
-   [ ] The scheduler ranks eligible parcels deterministically.
-   [ ] Truck weight capacity is never exceeded.
-   [ ] No-deadline parcels can fill spare capacity.
-   [ ] Maximum waiting conflicts are visible.
-   [ ] Deadline/capacity conflicts are visible.
-   [ ] Batch generation is atomic and idempotent.
-   [ ] Dispatch occurs only at/after scheduled time.
-   [ ] Parcel status history is recorded.
-   [ ] Tracking returns current status and chronological history.
-   [ ] Runtime data structures can be rebuilt after backend restart.
-   [ ] No separate reports/analytics module is created.

**Implementation instruction to the coding agent:** Treat this document
as the source of truth. Implement the modules in the stated sequence.
Keep business logic out of React components, keep SQL access in
repositories, keep data-structure implementations in their own files,
and keep the scheduling engine independent of Express and MySQL so it
can be tested with plain JavaScript inputs. Implement authentication as
a small cross-cutting feature for one seeded operator; do not expand it
into multi-user management or role-based access control. If a requirement is
ambiguous, preserve the stated defaults and ask before introducing a
different business rule.
