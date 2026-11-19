# account-management Specification

## Purpose
Gives each author control over their own account: how their name appears, and the ability to delete the account together with everything storyforge holds for them.

## Requirements

### Requirement: Author can set a display name
A signed-in author SHALL be able to set a display name of 1–80 characters (surrounding whitespace removed) on the settings page.

#### Scenario: Valid name
- **WHEN** an author saves "Rafael" as their display name
- **THEN** the name is stored and shown in the app header

#### Scenario: Invalid name
- **WHEN** an author saves an empty name or one longer than 80 characters
- **THEN** a validation message is shown and the stored name is unchanged

### Requirement: Author can delete their account
A signed-in author SHALL be able to delete their account after typing `DELETE` to confirm. Deletion SHALL require a session created within the last 24 hours, SHALL sign the author out, and SHALL remove the account, its sessions and its sign-in methods immediately.

#### Scenario: Confirmed deletion
- **WHEN** an author with a recent session types `DELETE` and confirms
- **THEN** the account, its sessions and sign-in methods are removed, the author is signed out and sees a confirmation page, and signing in again with the same email creates a new, empty account

#### Scenario: Missing confirmation
- **WHEN** the author confirms without typing `DELETE` exactly
- **THEN** nothing is deleted

#### Scenario: Old session
- **WHEN** an author whose session is older than 24 hours tries to delete the account
- **THEN** nothing is deleted and they are asked to sign in again first

### Requirement: Deleted accounts are purged
After an account is deleted, the system SHALL remove every row and stored file belonging to that user within 24 hours by running a background purge, and SHALL record that the purge finished without recording the user's email or content.

#### Scenario: Purge runs
- **WHEN** an account is deleted
- **THEN** a purge job for that user id is queued, runs every registered purge step, and logs completion with the user id and the number of steps

#### Scenario: Purge step fails
- **WHEN** a purge step fails
- **THEN** the job is retried and the failure is logged with the user id and step name, without the user's data
