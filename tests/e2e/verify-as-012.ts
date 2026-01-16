/**
 * Verification Code from Spec for TEST-AS-012
 */
import * as fs from "fs";
import * as path from "path";
import assert from "assert";

async function verify() {
  console.log("Running spec verification code for TEST-AS-012...\n");

  const { createIdeaFolder, renameIdeaFolder, loadArtifact } =
    await import("../../agents/ideation/unified-artifact-store.js");
  const { getConfig } = await import("../../config/index.js");
  const config = getConfig();
  const projectRoot = path.dirname(config.paths.ideas);
  const usersRoot = path.join(projectRoot, "users");

  const testUser = "test-user";
  const oldPath = path.resolve(usersRoot, testUser, "ideas", "old-name");
  const newPath = path.resolve(usersRoot, testUser, "ideas", "new-name");

  // Cleanup
  if (fs.existsSync(oldPath)) fs.rmSync(oldPath, { recursive: true });
  if (fs.existsSync(newPath)) fs.rmSync(newPath, { recursive: true });

  await createIdeaFolder("test-user", "old-name", "business");
  await renameIdeaFolder("test-user", "old-name", "new-name");

  assert(!fs.existsSync(oldPath), "Old folder should not exist");
  console.log("✓ Old folder does not exist");

  assert(fs.existsSync(newPath), "New folder should exist");
  console.log("✓ New folder exists");

  // Cleanup
  if (fs.existsSync(oldPath)) fs.rmSync(oldPath, { recursive: true });
  if (fs.existsSync(newPath)) fs.rmSync(newPath, { recursive: true });

  console.log("\n✓ VERIFICATION PASSED");
}

verify().catch(console.error);
