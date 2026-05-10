import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAdminUserIds,
  isAdminUserId,
  isAdminConfigured,
  requireAdmin,
  AdminAccessError,
} from "../admin";

describe("admin gate", () => {
  const originalEnv = process.env.ADMIN_USER_IDS;

  beforeEach(() => {
    delete process.env.ADMIN_USER_IDS;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = originalEnv;
  });

  describe("getAdminUserIds", () => {
    it("returns empty set when env is unset", () => {
      expect(getAdminUserIds().size).toBe(0);
    });

    it("returns empty set when env is empty string", () => {
      process.env.ADMIN_USER_IDS = "";
      expect(getAdminUserIds().size).toBe(0);
    });

    it("parses a single id", () => {
      process.env.ADMIN_USER_IDS = "abc123";
      const ids = getAdminUserIds();
      expect(ids.size).toBe(1);
      expect(ids.has("abc123")).toBe(true);
    });

    it("parses multiple comma-separated ids with whitespace", () => {
      process.env.ADMIN_USER_IDS = "id1, id2 ,id3";
      const ids = getAdminUserIds();
      expect(ids.size).toBe(3);
      expect(ids.has("id1")).toBe(true);
      expect(ids.has("id2")).toBe(true);
      expect(ids.has("id3")).toBe(true);
    });

    it("ignores empty entries (trailing commas)", () => {
      process.env.ADMIN_USER_IDS = "id1,,id2,";
      const ids = getAdminUserIds();
      expect(ids.size).toBe(2);
    });
  });

  describe("isAdminUserId", () => {
    it("is false for null/undefined/empty", () => {
      expect(isAdminUserId(null)).toBe(false);
      expect(isAdminUserId(undefined)).toBe(false);
      expect(isAdminUserId("")).toBe(false);
    });

    it("is false when no admins configured", () => {
      expect(isAdminUserId("anyid")).toBe(false);
    });

    it("is true when id matches the allowlist", () => {
      process.env.ADMIN_USER_IDS = "owner123";
      expect(isAdminUserId("owner123")).toBe(true);
      expect(isAdminUserId("notowner")).toBe(false);
    });
  });

  describe("requireAdmin", () => {
    it("throws AdminAccessError for non-admins", () => {
      process.env.ADMIN_USER_IDS = "admin1";
      expect(() => requireAdmin("user2")).toThrow(AdminAccessError);
    });

    it("does not throw for admins", () => {
      process.env.ADMIN_USER_IDS = "admin1";
      expect(() => requireAdmin("admin1")).not.toThrow();
    });

    it("throws for null/undefined userId regardless of config", () => {
      process.env.ADMIN_USER_IDS = "admin1";
      expect(() => requireAdmin(null)).toThrow(AdminAccessError);
      expect(() => requireAdmin(undefined)).toThrow(AdminAccessError);
    });
  });

  describe("isAdminConfigured", () => {
    it("is false with no env", () => {
      expect(isAdminConfigured()).toBe(false);
    });

    it("is true with at least one admin", () => {
      process.env.ADMIN_USER_IDS = "x";
      expect(isAdminConfigured()).toBe(true);
    });
  });
});
