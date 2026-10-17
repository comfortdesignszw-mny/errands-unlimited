CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,phone TEXT,name TEXT,role TEXT DEFAULT 'client',image TEXT,salt TEXT,hash TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT,exp INTEGER);
CREATE TABLE IF NOT EXISTS tries(k TEXT PRIMARY KEY,n INTEGER,until INTEGER);
CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY,name TEXT,phone TEXT,tr TEXT,ar TEXT,bio TEXT,sv TEXT,img TEXT,listed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS errands(id TEXT PRIMARY KEY,client_id TEXT,title TEXT,service TEXT,details TEXT,pickup TEXT,dropoff TEXT,dt TEXT,tm TEXT,budget TEXT,area TEXT,status TEXT DEFAULT 'open',created INTEGER);
CREATE TABLE IF NOT EXISTS reqs(id TEXT PRIMARY KEY,ref TEXT,kind TEXT,errand_id TEXT,client_id TEXT,messenger_id TEXT,service TEXT,details TEXT,pickup TEXT,dropoff TEXT,dt TEXT,tm TEXT,price TEXT,st TEXT DEFAULT 'pending',created INTEGER);
CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,user_id TEXT,title TEXT,body TEXT,ts INTEGER,read INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS rules(resource TEXT,action TEXT,roles TEXT,PRIMARY KEY(resource,action));
INSERT OR REPLACE INTO rules VALUES
('profile','read','guest,client,messenger,admin'),('profile','write','messenger,admin'),
('errand','read','guest,client,messenger,admin'),('errand','create','client,messenger,admin'),('errand','offer','messenger,admin'),
('request','create','client,messenger,admin'),('request','read','client,messenger,admin'),('request','update','client,messenger,admin'),
('note','read','client,messenger,admin'),('user','update','client,messenger,admin');
