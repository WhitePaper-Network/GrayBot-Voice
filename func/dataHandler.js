const fs = require("fs");
const sqlite3 = require("sqlite3");

const dataFilePath = "./data.json";
const dbPath = "./data.db";

let db;

function connectToDatabase() {
    if (db) return db;
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error connecting to database:", err.message);
        }
    });
    return db;
}

function closeDatabase() {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error("Error closing the database:", err.message);
            }
        });
        db = null;
    }
}

function runQuery(query, params = []) {
    const db = connectToDatabase();
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) {
                console.error("Error running query:", query, params);
                reject(err);
                closeDatabase()
            } else {
                resolve(this);
                closeDatabase()
            }
        });
    });
}

function allQuery(query, params = []) {
    const db = connectToDatabase();
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Error running query:", query, params);
                reject(err);
                closeDatabase()
            } else {
                resolve(rows);
                closeDatabase()
            }
        });
    });
}

function readData() {
  try {
    const data = fs.readFileSync(dataFilePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading data.json:", error);
    return null;
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, '  '));
  } catch (error) {
    console.error("Error writing to data.json:", error);
  }
}

module.exports = {
  readData,
  writeData,
  connectToDatabase,
  closeDatabase,
  runQuery,
  allQuery,
};