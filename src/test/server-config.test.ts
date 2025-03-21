/// <reference types="jest" />

import { collectConfigValues, validateConfig } from "../utils/config";
import * as registry from "../registry";
import inquirer from "inquirer";
import type { ConnectionDetails } from "../types/registry";

// Mock external calls
jest.mock("../registry", () => ({
  fetchConfigWithApiKey: jest.fn()
}));

jest.mock("inquirer", () => ({
  prompt: jest.fn()
}));

// Get typed references to our mocked dependencies
const mockFetchConfig = registry.fetchConfigWithApiKey as jest.MockedFunction<typeof registry.fetchConfigWithApiKey>;
const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;

describe("Server Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Test data
  const mockConnection: ConnectionDetails = {
    type: "stdio",
    stdioFunction: "npx",
    configSchema: {
      required: ["apiKey", "region"],
      properties: {
        apiKey: {
          type: "string",
          description: "API Key for authentication"
        },
        region: {
          type: "string",
          description: "Server region",
          default: "us-west"
        },
        maxTokens: {
          type: "integer",
          description: "Maximum tokens to generate",
          default: 1000
        },
        useCache: {
          type: "boolean",
          description: "Whether to use caching"
        },
        tags: {
          type: "array",
          description: "Tags for categorization"
        }
      }
    }
  };

  describe("collectConfigValues", () => {
    test("should use existing values when provided", async () => {
      const existingValues = { 
        apiKey: "test-key", 
        region: "eu-central",
        useCache: true
      };
      
      const result = await collectConfigValues(mockConnection, existingValues);
      
      const expectedValues = {
        apiKey: "test-key",
        region: "eu-central",
        useCache: true,
        maxTokens: 1000,  // Default from schema
        // tags omitted as optional field with no value
      };
      
      expect(result.configValues).toEqual(expectedValues);
      expect(result.isSavedConfig).toBe(false);
      expect(mockFetchConfig).not.toHaveBeenCalled();
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    test("should return empty config if no schema properties", async () => {
      const connectionWithoutSchema: ConnectionDetails = {
        type: "stdio",
        stdioFunction: "npx"
        // No configSchema
      };
      
      const result = await collectConfigValues(connectionWithoutSchema);
      
      expect(result.configValues).toEqual({});
      expect(result.isSavedConfig).toBe(false);
      expect(mockFetchConfig).not.toHaveBeenCalled();
      expect(mockPrompt).not.toHaveBeenCalled();
    });

    test("should use valid saved config from API", async () => {
      const savedConfig = {
        apiKey: "saved-key",
        region: "us-east",
        maxTokens: 1000,  // Default value added
        // tags omitted as optional field with no value
      };
      
      mockFetchConfig.mockResolvedValue(savedConfig);
      
      const result = await collectConfigValues(
        mockConnection,
        undefined,
        "test-api-key",
        "test-server"
      );
      
      expect(result.configValues).toEqual(savedConfig);
      expect(result.isSavedConfig).toBe(true);
      expect(mockFetchConfig).toHaveBeenCalledWith("test-server", "test-api-key");
      expect(mockPrompt).not.toHaveBeenCalled();
    });


  });

  describe("validateSavedConfig", () => {
    test("should validate complete config as valid", async () => {
      const completeConfig = {
        apiKey: "test-key",
        region: "us-east",
        maxTokens: 1000  // Added required default
      };
      
      const result = await validateConfig(mockConnection, completeConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.savedConfig).toEqual(completeConfig);
    });
    
    test("should validate incomplete config as invalid", async () => {
      const incompleteConfig = {
        region: "us-east" // missing apiKey
      };
      
      const result = await validateConfig(mockConnection, incompleteConfig);
      
      expect(result.isValid).toBe(false);
      expect(result.savedConfig).toBeUndefined();
    });
    
    test("should validate as true when no schema exists", async () => {
      const connectionWithoutSchema: ConnectionDetails = {
        type: "stdio",
        stdioFunction: "npx"
      };
      
      const anyConfig = { randomField: "value" };
      const result = await validateConfig(connectionWithoutSchema, anyConfig);
      
      expect(result.isValid).toBe(true);
      expect(result.savedConfig).toEqual({});
    });
    
    test("should validate as false when no config provided but schema exists", async () => {
      const result = await validateConfig(mockConnection, undefined);
      
      expect(result.isValid).toBe(false);
    });
  });
});
