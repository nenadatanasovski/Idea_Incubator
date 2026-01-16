/**
 * Verification code from the spec for TEST-FS-008
 */

import * as fs from "fs";
import {
  createDraftFolder,
  renameDraftToIdea,
  createUserFolder,
} from "../../utils/folder-structure.js";

async function verify() {
  console.log("Running spec verification code for TEST-FS-008...\n");

  // Setup
  await createUserFolder("test-user");

  // Create draft and add file
  const { draftId } = await createDraftFolder("test-user");
  fs.writeFileSync(`users/test-user/ideas/${draftId}/test.md`, "test");

  // Rename draft to idea
  const newPath = await renameDraftToIdea(
    "test-user",
    draftId,
    "my-new-idea",
    "business",
  );

  // Assertions from spec
  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✅ ${message}`);
  };

  assert(
    !fs.existsSync(`users/test-user/ideas/${draftId}`),
    "Draft folder no longer exists",
  );
  assert(fs.existsSync(newPath), "New idea folder exists");
  assert(fs.existsSync(`${newPath}/test.md`), "test.md preserved");
  assert(fs.existsSync(`${newPath}/README.md`), "README.md created");

  // Cleanup
  fs.rmSync("users/test-user", { recursive: true });

  console.log("\n✅ All spec verification assertions passed!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
