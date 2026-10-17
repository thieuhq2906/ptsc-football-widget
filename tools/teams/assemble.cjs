// Joins the generated data and the browser helpers into ../../teams.js.
const fs = require("fs"), path = require("path");
const data = fs.readFileSync(path.join(__dirname, "teams-data.json"), "utf8"), header = fs.readFileSync(path.join(__dirname, "teams-header.txt"), "utf8");
fs.writeFileSync(path.join(__dirname, "..", "..", "teams.js"), header + "window.PTSC_TEAMS = " + data + ";\n" + fs.readFileSync(path.join(__dirname, "teams-tail.js"), "utf8"));
console.log("teams.js written");
