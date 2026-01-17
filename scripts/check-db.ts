import { getOne } from "../database/db.js";

async function main() {
  const taskList = await getOne("SELECT * FROM task_lists_v2 WHERE id = ?", [
    "verif-list-001",
  ]);
  console.log("Task List found:", taskList);
}

main().catch(console.error);
