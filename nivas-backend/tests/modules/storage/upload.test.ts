import { describe, expect, it, mock, beforeEach } from "bun:test";
import { createTestApp } from "../../test-utils";

// Mock FS and Bun.write
const mockMkdir = mock();
const mockWrite = mock();

mock.module("fs/promises", () => ({
    mkdir: mockMkdir
}));

const mockUsersFindFirst = mock();
mock.module("../../../src/db", () => ({
    db: {
        query: {
            users: { findFirst: mockUsersFindFirst }
        }
    }
}));

// Mock Bun.write (global in Bun, but needs careful handling or wrapper injection really,
// but here checking if we can mock it via module or just spying?
// Bun.write is tough to mock directly in module mock if it's not imported.
// The controller uses `await Bun.write(...)`.
// We can try to attach to global Bun object if possible or rely on the fact it writes to disk (integration-ish).
// BETTER STRATEGY: Mock the implementation of the route handler? No, we want to test logic.
// Let's assume for this environment we can't easily mock global Bun.write without a wrapper.
// HOWEVER, we can check if fs/promises write is used? No, code uses Bun.write.
// Let's rely on `mkdir` mock to verify path creation at least.
// And passing a dummy file. 
// Actually, `bun:test` might not easily mock `Bun.write`. 
// We will focus on the validation logic (size/type) which throws errors BEFORE writing.
// For the success case, it might actually write a file. We should use a temp dir or valid mock.

import { uploadController } from "../../../src/modules/storage/upload.controller";

describe("Storage - Upload Controller", () => {
    let app: any;
    let validToken: string;

    beforeEach(async () => {
        mockMkdir.mockReset();
        mockWrite.mockReset();
        mockUsersFindFirst.mockReset();
        mockUsersFindFirst.mockResolvedValue({ id: "user-1", isActive: true, hotelId: 1 });

        // Mock Bun.write globally for this test context if possible or just ignore side effect?
        // We'll proceed with validation tests primarily.

        app = createTestApp(uploadController);

        const { Elysia } = await import("elysia");
        const { jwt } = await import("@elysiajs/jwt");
        const { config } = await import("../../../src/config/env");
        const jwtApp = new Elysia().use(jwt({ name: 'jwt', secret: config.jwt.secret }));

        validToken = await (jwtApp as any).decorator.jwt.sign({
            id: "user-1",
            hotelId: 1,
            type: "HOTEL_STAFF",
            permissions: ["STORAGE.UPLOAD"]
        });
    });

    it("POST /storage/upload - should reject invalid file type", async () => {
        const formData = new FormData();
        const file = new Blob(["dummy content"], { type: "text/plain" });
        formData.append("file", file);

        const req = new Request("http://localhost/storage/upload", {
            method: "POST",
            headers: { "Authorization": `Bearer ${validToken}` },
            body: formData
        });

        const res = await app.handle(req);
        // Validating type logic
        expect(res.status).toBe(400);
    });
});
