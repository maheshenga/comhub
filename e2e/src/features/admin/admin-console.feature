@admin @smoke
Feature: Admin Console Baseline
  Current-behavior safety net for the admin console (redesign blueprint Phase 0,
  "admin e2e 3-5 条"): an admin can reach /settings/admin/* and the core admin
  pages render, load their lists, filter, and gate dangerous actions.

  Background:
    Given I am logged in as an admin test user

  @ADMIN-WORKBENCH-001 @P0
  Scenario: Admin workbench renders after login
    When I navigate to "/settings/admin"
    Then the page should load without errors
    And the admin layout shell should be visible
    And the admin workbench should not be blank

  @ADMIN-USERS-002 @P0
  Scenario: User management list loads and supports search
    Given I navigate to "/settings/admin/users"
    Then the page should load without errors
    And the admin user list should be loaded
    When I search users for "e2e-no-such-user"
    Then the user table should show the empty state

  @ADMIN-ORDERS-003 @P0
  Scenario: Order list loads
    Given I navigate to "/settings/admin/orders"
    Then the page should load without errors
    And the admin order list should be loaded

  @ADMIN-AUDIT-004 @P0
  Scenario: Audit page filter accepts the actorUserId input
    Given I navigate to "/settings/admin/audit?actorUserId=user_actor_001"
    Then the page should load without errors
    And the audit actor filter should be prefilled with "user_actor_001"
    When I set the audit actor filter to "user_actor_002"
    Then the audit page should keep rendering without a load error

  @ADMIN-DANGER-005 @P0
  Scenario: Dangerous action requires typing the confirmation text
    Given I navigate to "/settings/admin/users"
    When I open the "重置所有用户为免费套餐" confirmation
    Then the confirmation dialog should require typing "user.resetAllToFreePlan"
    And confirming with a wrong text should show a mismatch error
