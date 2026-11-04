# Assentry

**The connection between people, AI agents and the internet.**

## 1. The Idea

Imagine telling your AI assistant to apply for jobs, book appointments, shop online or complete forms on your behalf. You should be able to give it instructions and let it get the job done without constantly stepping in to log in, prove your identity or complete security checks.

Today, most websites are designed for people to use directly. They do not have a consistent way to recognise an AI assistant acting with a person's permission.

**Assentry is a platform that connects people, their AI assistants and online systems, allowing AI agents to prove whom they represent and what they are authorised to do.**

With Assentry, people will manage their identity and permissions in one place. AI assistants will be able to use that authorisation when interacting with participating websites. Websites will be able to verify the agent and decide whether to allow it to perform the requested action.

Our goal is simple: **make it possible for people to delegate online tasks to AI while remaining in control of their identity, information and decisions.**

## 2. The Problem We Are Solving

As AI assistants become more capable, people will increasingly want them to do things online, rather than simply provide answers.

However, three problems stand in the way.

**Problem 1: Websites do not have a consistent way to recognise authorised AI agents.**

When an AI assistant visits a website, the website may not know who it represents or whether the user has given it permission to act. As a result, legitimate AI activity can be treated like unwanted automation.

**Problem 2: Websites rely on verification processes designed for people.**

Websites often require users to log in, complete CAPTCHA challenges, enter verification codes or manually confirm actions. These steps can interrupt an AI assistant even when the user has already authorised it to complete the task.

**Problem 3: People need control over what their AI assistants can do.**

Giving an AI assistant access to an account should not mean giving it unlimited authority. People need a way to specify what information an agent can use, which actions it can perform and when it must ask for approval.

Assentry aims to solve these problems by providing a common way to establish identity and permission between people, AI agents and participating websites.

## 3. How Assentry Will Work

Assentry will have three connected parts.

### A. Assentry App — For People

The Assentry app is where people create and manage their identity and control what their AI assistants are allowed to do.

Users will be able to:

- Create and manage their Assentry identity.
- Connect AI assistants they already use, such as Claude, ChatGPT and Grok, through supported integrations.
- Decide what personal information an AI assistant can access.
- Authorise specific tasks and actions.
- Set limits on what an AI assistant can do.
- Approve sensitive actions when necessary.
- Review the actions their AI assistants have taken.
- Withdraw permissions whenever they choose.

For example, a user could authorise an AI assistant to search for jobs and submit applications using their approved CV and employment information. That permission would not automatically allow the assistant to make purchases, sign contracts or access unrelated personal information.

The purpose is to give people one place to manage their identity and the authority they delegate to AI.

### B. Assentry for Websites — The Developer SDK and API

Websites will be able to integrate Assentry using a software development kit (SDK) and API.

This will allow participating websites to verify an AI agent's identity and check whether it has permission to perform a requested action on behalf of a user.

When an AI agent visits a website, Assentry will help establish:

- Which agent is making the request.
- Which user the agent represents.
- Whether the user's authorisation is valid.
- What the agent is permitted to do.
- Whether additional verification or human approval is required.

The website can then decide whether to allow the action.

For example, a job website could allow an authorised agent to create an account and submit a job application without requiring the user to complete every step manually. The website could still request additional approval for a legally significant declaration.

Assentry will provide the underlying identity and authorisation capabilities, reducing the need for each website to develop its own complete solution.

### C. Assentry for AI Agents — The Integration

AI agents are the systems that carry out tasks on behalf of people. They need a way to connect to Assentry, request permission and present proof of their authority when interacting with participating websites.

We will build integrations that allow compatible AI assistants to use Assentry.

Our aim is to support existing AI environments, including Claude, ChatGPT and Grok, through the integration methods available to them. We can start with one AI environment and expand as the product develops.

Users should not need to abandon their preferred AI assistant to use Assentry.

Instead, Assentry will provide the identity and authorisation layer that allows supported AI agents to act on behalf of their users.

Connecting an AI assistant will not automatically grant unlimited access or make every website compatible. The experience will depend on the integrations and permissions supported by each system.

## 4. Assentry Verification — A Better Way to Recognise AI Agents

One of Assentry's core features will be helping websites verify authorised AI agents.

Today, a website may use CAPTCHA to determine whether a visitor is human or automated. But as AI agents become a normal way to access online services, websites will need more than a simple distinction between humans and bots.

Assentry introduces a different question:

**Can this AI agent prove whom it represents and demonstrate that it has permission to perform this action?**

When a participating website encounters an AI agent, it can use Assentry to check the agent's identity and authorisation.

If the agent provides valid proof and meets the website's requirements, the website may allow it to continue without a human-oriented CAPTCHA challenge or another redundant verification step.

If the agent is unknown, lacks permission or fails verification, the website can block the action or require additional checks.

Assentry is not intended to eliminate every CAPTCHA or security measure. Websites will still need protection against fraud, abuse and malicious automation.

The goal is to help websites recognise legitimate, authorised AI activity while retaining control over their security.

## 5. How Assentry Could Remove Unnecessary Verification Steps

The long-term aim is to reduce the need for repeated verification when a person has already established their identity and authorised an AI agent.

Consider a user who wants an AI assistant to register for an online service.

With a compatible website and Assentry integration:

1. The user has an identity managed through Assentry.
2. The user authorises the AI agent to register for the service.
3. The AI agent visits the website and presents its verifiable identity and authority.
4. The website checks that the authorisation is valid and covers the requested action.
5. The website allows the agent to proceed if the request meets its security requirements.

In this situation, the website may not need to ask the user to complete a separate verification process simply to establish the same identity and permission again.

However, Assentry cannot automatically eliminate verification requirements on websites that do not support it. Nor should it bypass additional checks required for account recovery, financial transactions, legal declarations or other sensitive activities.

**The principle is to replace unnecessary repeated checks with trusted, verifiable authorisation—not to remove security.**

## 6. An Example: Asking AI to Apply for Jobs

Imagine telling Claude to find suitable jobs and apply for them on your behalf.

Here is how Assentry could make that possible.

1. You create your identity in Assentry and connect Claude through a supported integration.
2. You authorise Claude to use your CV and relevant employment information for job applications.
3. Claude finds a suitable job on a website that supports Assentry.
4. The website uses Assentry to verify that Claude represents you and has permission to apply.
5. The website allows Claude to complete the application within the permissions granted.
6. If a sensitive declaration requires your personal approval, Claude asks you before proceeding.
7. You receive a report showing which applications were completed and which need your attention.

The website does not need to trust Claude simply because it is an AI assistant. It can verify the authority behind the request and apply its own rules.

The same approach could eventually support online shopping, bookings, subscriptions, registrations, professional services and many other activities.

Websites that have not integrated Assentry will not automatically recognise its identity and authorisation mechanism. Those tasks may still require conventional authentication or human involvement.

## 7. How We Will Build Assentry

We will build the product in stages, starting with a small working demonstration rather than trying to support the entire internet immediately.

**Stage 1: Build the identity and permissions foundation.**

Create the Assentry app, user identity management and a system for granting, checking and withdrawing permissions.

**Stage 2: Connect one AI assistant.**

Build an integration with one supported AI environment so that the assistant can request permission and use Assentry's identity and authorisation capabilities.

**Stage 3: Integrate one website.**

Build the Assentry developer SDK and integrate it into a website we control or a partner website. Demonstrate how the website verifies an AI agent and checks its authority before allowing an action.

**Stage 4: Demonstrate a complete task.**

Show a user authorising an AI agent to perform a real task on a participating website, with identity verification, permission checks and a report of the outcome.

**Stage 5: Expand to more AI agents and websites.**

Once the first workflow works and we have validated demand, extend Assentry to other AI environments and participating services.

Our first goal is to prove that Assentry can make one real online task easier, safer and more reliable.

## 8. What Assentry Is Really Building

Assentry is not simply another identity app or CAPTCHA product.

It is infrastructure that helps answer three essential questions:

- **Who does this AI agent represent?**
- **What has that person authorised it to do?**
- **Can this website safely allow the requested action?**

The Assentry app gives people control over their identity and permissions.

The Assentry developer tools allow websites to verify agents and enforce their own policies.

The Assentry integrations allow AI agents to request and present the appropriate authorisation.

These three parts work together as one platform.

We will build on established identity and security standards wherever possible. Assentry will provide a way to verify identity and delegated authority, but participating websites will retain control over what they allow.

## 9. Our Long-Term Vision

As AI assistants become more capable, people will increasingly delegate tasks to them across the internet.

We believe there should be a common way for people to authorise these agents, for agents to demonstrate their authority and for websites to verify that authority before allowing them to act.

Assentry aims to become that connection.

Our long-term ambition is to build an identity and authorisation platform that works across different AI assistants and participating websites, without depending on a single AI provider.

**Assentry: the connection between people, AI agents and the digital world.**

People control their identity. AI agents carry out their instructions. Websites verify their authority. Assentry connects them all.