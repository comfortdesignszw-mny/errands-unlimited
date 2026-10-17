-- Wipes ALL accounts and data for a fresh start (keeps tables and RBAC rules).
DELETE FROM notes; DELETE FROM reqs; DELETE FROM errands; DELETE FROM profiles;
DELETE FROM sessions; DELETE FROM tries; DELETE FROM users;
