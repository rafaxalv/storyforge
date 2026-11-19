# auth-session Specification

## Purpose
Lets authors sign in to storyforge with an emailed link or Google, keeps them signed in, and gives every server function one consistent rule for who may read or change what.

## Requirements

### Requirement: Sign in with an emailed magic link
The system SHALL let a visitor request a sign-in link for an email address, send a single-use link to that address that expires after 15 minutes, and sign the visitor in (creating the account on first use) when the link is opened. The response to the request SHALL be the same whether or not an account exists for that address.

#### Scenario: First sign-in creates the account
- **WHEN** a visitor requests a link for a new address and opens the emailed link within 15 minutes
- **THEN** an account is created for that address, a session cookie is set, and the visitor lands on the home page signed in

#### Scenario: Returning author signs in
- **WHEN** an existing author requests a link and opens it
- **THEN** they are signed in to their existing account and no second account is created

#### Scenario: Used or expired link
- **WHEN** a link is opened a second time, or after 15 minutes
- **THEN** no session is created and the visitor sees the sign-in page with a message that the link is no longer valid

#### Scenario: Invalid address
- **WHEN** a visitor submits a value that is not an email address
- **THEN** the form shows a validation message and no email is sent

### Requirement: Sign in with Google
When Google sign-in is configured, the system SHALL offer a "Continue with Google" option that signs the author in to the account matching their verified Google email, creating it on first use. When it is not configured, the option SHALL NOT be shown.

#### Scenario: Google configured
- **WHEN** Google client credentials are configured and a visitor completes the Google consent
- **THEN** they are signed in, and an author who first signed in by email with the same verified address uses the same account

#### Scenario: Google not configured
- **WHEN** no Google client credentials are configured
- **THEN** the sign-in page shows only the email form

### Requirement: Session lifetime and sign-out
A session SHALL last 30 days, be extended when used, be held in an HTTP-only cookie (secure in production), and end immediately on sign-out.

#### Scenario: Session persists
- **WHEN** a signed-in author returns within 30 days
- **THEN** they are still signed in without a new link

#### Scenario: Sign-out
- **WHEN** a signed-in author signs out
- **THEN** the session is deleted on the server, the cookie is cleared, and opening an app page redirects to sign-in

### Requirement: App pages require a session
Every page except the sign-in pages SHALL require a valid session; `/api/health` SHALL stay public. A visitor without a valid session SHALL be redirected to sign-in and, after signing in, returned to the page they asked for if it is a page of this app.

#### Scenario: Signed-out visitor
- **WHEN** a visitor without a session opens `/settings`
- **THEN** they are redirected to `/sign-in?next=/settings`, and after signing in they land on `/settings`

#### Scenario: Foreign redirect target
- **WHEN** the `next` parameter points outside the app (another host or a protocol-relative URL)
- **THEN** the author lands on the home page instead

#### Scenario: Health stays public
- **WHEN** a client without a session requests `/api/health`
- **THEN** it gets the normal health response

### Requirement: Sign-in attempts are rate limited
The system SHALL limit sign-in link requests per client to 5 per 10 minutes and reject further requests with HTTP 429 and a message to try later, without sending email. Limits SHALL hold across server processes.

#### Scenario: Too many link requests
- **WHEN** a client requests a sixth sign-in link within 10 minutes
- **THEN** the system responds 429, sends no email and logs the rejection

### Requirement: Access is checked on the server for every protected operation
Every server function that reads or changes user data SHALL first establish the signed-in actor and SHALL refuse access to data the actor does not own unless the operation is explicitly admin-only and the actor is an admin. Refusals SHALL NOT reveal whether the other user's data exists.

#### Scenario: No session
- **WHEN** a protected server function runs without a valid session
- **THEN** it fails as unauthenticated (HTTP 401 for API calls) and changes nothing

#### Scenario: Another user's data
- **WHEN** a signed-in author asks to read or change data owned by another user
- **THEN** it fails as forbidden (HTTP 404 for API calls) and changes nothing

#### Scenario: Admin-only operation by a non-admin
- **WHEN** an author who is not an admin calls an admin-only operation
- **THEN** it fails as forbidden and changes nothing

### Requirement: Admin role comes from configuration
Authors whose email is listed in `ADMIN_EMAILS` SHALL have the admin role, and authors not listed SHALL NOT; the role SHALL be brought in line with the list each time the author signs in.

#### Scenario: Listed author signs in
- **WHEN** an author whose email is in `ADMIN_EMAILS` signs in
- **THEN** their role is admin

#### Scenario: Author removed from the list
- **WHEN** an author who was admin is removed from `ADMIN_EMAILS` and signs in again
- **THEN** their role is user
