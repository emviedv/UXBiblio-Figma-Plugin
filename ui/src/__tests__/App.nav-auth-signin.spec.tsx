import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { act, cleanupApp, renderApp, tick, dispatchPluginMessage } from "../../../tests/ui/testHarness";

describe("App - Navigation Sign In Button", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanupApp();
    vi.restoreAllMocks();
  });

  describe("Sign In button visibility based on authentication state", () => {
    it("should display Sign In button when user is anonymous (not authenticated)", async () => {
      const container = renderApp();
      await tick();
      
      // Send anonymous user status
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "anonymous",
            totalFreeCredits: 3,
            remainingFreeCredits: 3
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      // Sign In button should be visible for anonymous users
      const signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeTruthy();
      expect(signInButton?.textContent).toBe("Sign In");
    });

    it("should NOT display Sign In button when user has paid access (pro status)", async () => {
      const container = renderApp();
      await tick();
      
      // Send pro user status
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "pro",
            totalFreeCredits: 0,
            remainingFreeCredits: 0
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      // Sign In button should NOT be visible for pro users
      const signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeFalsy();
    });

    it("should NOT display Sign In button when user is in trial (has trial access)", async () => {
      const container = renderApp();
      await tick();
      
      // Send trial user status
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "trial",
            totalFreeCredits: 10,
            remainingFreeCredits: 5
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      // Sign In button should NOT be visible for trial users (they have trial access)
      const signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeFalsy();
    });

    it("should handle auth status transitions correctly", async () => {
      const container = renderApp();
      await tick();
      
      // Initially anonymous - Sign In should be visible
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "anonymous",
            totalFreeCredits: 3,
            remainingFreeCredits: 3
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      let signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeTruthy();
      
      // Transition to pro status
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "pro",
            totalFreeCredits: 0,
            remainingFreeCredits: 0
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      // After transition to pro, Sign In should be hidden
      signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeFalsy();
      
      // Transition back to anonymous
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "anonymous",
            totalFreeCredits: 3,
            remainingFreeCredits: 3
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      // After transition back to anonymous, Sign In should be visible again
      signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeTruthy();
    });
  });

  describe("Sign In button interaction", () => {
    it("should call handleOpenAuthPortal when Sign In button is clicked", async () => {
      const container = renderApp();
      await tick();
      
      const postMessageSpy = window.parent.postMessage as Mock;
      postMessageSpy.mockClear(); // Clear UI_READY message
      
      // Ensure we're in anonymous state
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "anonymous",
            totalFreeCredits: 3,
            remainingFreeCredits: 3
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      const signInButton = container.querySelector('.header-auth-link') as HTMLButtonElement;
      expect(signInButton).toBeTruthy();
      
      // Click the Sign In button
      act(() => {
        signInButton.click();
      });
      await tick();
      
      // Verify that the auth portal open message was sent
      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginMessage: expect.objectContaining({
            type: "OPEN_AUTH_PORTAL"
          })
        }),
        "*"
      );
    });

    it("should have proper accessibility attributes on Sign In button", async () => {
      const container = renderApp();
      await tick();
      
      // Ensure we're in anonymous state
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "anonymous",
            totalFreeCredits: 3,
            remainingFreeCredits: 3
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      const signInButton = container.querySelector('.header-auth-link') as HTMLButtonElement;
      
      // Check accessibility attributes
      expect(signInButton).toBeTruthy();
      expect(signInButton.getAttribute("aria-label")).toBe("Sign in to UXBiblio");
      expect(signInButton.className).toContain("header-auth-link");
      expect(signInButton.type).toBe("button");
    });
  });

  describe("Edge cases", () => {
    it("should handle missing credits data gracefully", async () => {
      const container = renderApp();
      await tick();
      
      // Send message without credits data
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        } as any // Force type to test missing credits
      });
      await tick();
      
      // Should still show Sign In button (defaults to anonymous)
      const signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeTruthy();
    });

    it("should handle rapid auth status changes without issues", async () => {
      const container = renderApp();
      await tick();
      
      // Rapidly change auth status multiple times
      const statuses = ["anonymous", "pro", "trial", "pro"] as const;
      
      for (const status of statuses) {
        dispatchPluginMessage({
          type: "SELECTION_STATUS",
          payload: {
            credits: {
              accountStatus: status,
              totalFreeCredits: 0,
              remainingFreeCredits: 0
            },
            hasSelection: false,
            selectionName: "",
            frameCount: 0,
            hasExportableContent: false
          }
        });
        // Don't wait between messages to simulate rapid changes
      }
      
      await tick();
      
      // Final state should be pro (no Sign In button)
      const signInButton = container.querySelector('.header-auth-link');
      expect(signInButton).toBeFalsy();
    });

    it("should show correct banner messages based on auth status", async () => {
      const container = renderApp();
      await tick();
      
      // Test pro status banner
      dispatchPluginMessage({
        type: "SELECTION_STATUS",
        payload: {
          credits: {
            accountStatus: "pro",
            totalFreeCredits: 0,
            remainingFreeCredits: 0
          },
          hasSelection: false,
          selectionName: "",
          frameCount: 0,
          hasExportableContent: false
        }
      });
      await tick();
      
      const bannerCopy = container.querySelector('.analysis-grid-banner-copy');
      const bannerCallout = container.querySelector('.analysis-grid-banner-callout');
      
      expect(bannerCopy?.textContent).toBe("Signed in · Unlimited analyses unlocked");
      expect(bannerCallout?.textContent).toBe("UXBiblio Pro active");
    });
  });
});