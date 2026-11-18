## Purpose

Gives operators, tests and AI agents a reliable view of whether storyforge is running and lets every request be followed through the logs by one correlation id.

## ADDED Requirements

### Requirement: Health endpoint reports version and database status
The system SHALL expose `GET /api/health` without authentication, returning JSON with the application version and the database status, and SHALL NOT include configuration values, secrets or error details in the response.

#### Scenario: Database reachable
- **WHEN** a client requests `GET /api/health` while the database accepts connections
- **THEN** the system responds 200 with `{"version": "<app version>", "db": "ok"}`

#### Scenario: Database unreachable
- **WHEN** a client requests `GET /api/health` while the database is down or does not answer within 2 seconds
- **THEN** the system responds 503 with `{"version": "<app version>", "db": "error"}` and logs a warning naming the health check, without exposing the underlying error to the client

### Requirement: Every request carries a correlation id
The system SHALL assign each HTTP request a request id, reusing a well-formed incoming `x-request-id` header (1–64 characters of letters, digits, `-` or `_`) or generating a new one otherwise, and SHALL return it in the `x-request-id` response header.

#### Scenario: Incoming id is reused
- **WHEN** a client sends a request with header `x-request-id: abc-123`
- **THEN** the response carries `x-request-id: abc-123` and every log line written while handling it has `requestId` `abc-123`

#### Scenario: Missing or malformed id is replaced
- **WHEN** a client sends a request without `x-request-id`, or with a value longer than 64 characters or containing other characters
- **THEN** the system generates a new unique id, returns it in `x-request-id`, and uses it in the request's log lines

### Requirement: Every request is logged once
The system SHALL write exactly one structured `request` log line per HTTP request when it completes, with the request id, method, route, status code and duration in milliseconds, and SHALL NOT include request or response bodies, cookies or authorization headers.

#### Scenario: Successful request logged
- **WHEN** a client requests `GET /api/health`
- **THEN** one log line with event `request`, the request id, method `GET`, route `/api/health`, status `200` and a numeric `durationMs` is written

#### Scenario: Log level switch
- **WHEN** the process starts with `LOG_LEVEL=warn`
- **THEN** `request` lines (info) are not written while warnings and errors still are

### Requirement: Processes announce their startup
The web and worker processes SHALL each log one startup line at info level with the role (`web` or `worker`), application version, environment and active log level, and the worker SHALL log when it is ready to take jobs.

#### Scenario: Worker starts
- **WHEN** the worker process starts with the database reachable
- **THEN** it logs a startup line with role `worker` and then a `worker.ready` line

#### Scenario: Worker cannot reach the database
- **WHEN** the worker process starts while the database is unreachable
- **THEN** it logs an error line naming the database connection failure and exits with a non-zero status instead of running without a queue
