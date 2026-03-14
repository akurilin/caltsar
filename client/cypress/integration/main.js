before(() => {
  cy.request(`${Cypress.config().apiUrl}/auth/testlogin`);
  cy.getCookie(Cypress.config().cookieKey);
});

beforeEach(() => {
  // Cypress wipes all cookies before each test, so we have to ask it
  // to not clear the cookie
  Cypress.Cookies.preserveOnce(Cypress.config().cookieKey);
});

describe("Happy Path Test", () => {
  it("Should should log in and navigate around successfully", () => {
    cy.visit("/");
    cy.url().should("contain", "/sync");
    cy.url().should("contain", "/calendar");
    cy.get(".ant-badge-status-text");

    cy.get("[data-cy=events]").click();
    cy.get('[data-row-key="0"');
    cy.url().should("contain", "/events");

    cy.get("[data-cy=help]").click();
    cy.url().should("contain", "/help");
  });

  it("Should be able to log out", () => {
    cy.getCookie(Cypress.config().cookieKey);
    cy.get("[data-cy=logout]").click();
    cy.getCookie(Cypress.config().cookieKey).should("not.exist");
    cy.url().should("eq", `${Cypress.config("baseUrl")}/`);
  });
});
