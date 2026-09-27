# Meta Business Verification & App Delegation Guide

This document outlines the limitations of testing WhatsApp Flows, what requires Meta Business Verification, and how to delegate the verification process to a team member or client.

---

## 1. Testing WhatsApp Flows (Free vs. Paid)

You **do not need a paid account** to start building and testing WhatsApp Flows. However, there are strict limitations on where you can test them without verification.

### What You CAN Do For Free (Without Business Verification)
* **Flow Builder Preview:** You can use the **Meta Developer Test Number** (which is completely free) and access the **Interactive Preview Tool** in the WhatsApp Manager.
* **Testing Logic:** You can write your Flow JSON, build out all your custom screens, and test the interactions, dropdowns, and button logic inside the browser simulator without paying or verifying a business.

### The Catch: Testing on a REAL Device
If you want to send the Flow to your own physical phone (via the Meta Test Number) to see how it looks natively in the WhatsApp App, **you will be blocked**.
* Meta has strict anti-spam rules. If your Meta Business Portfolio is **unverified**, sending a Flow message to a real device will fail with an **"Integrity requirements not met" (Error 139000)**.
* The free Test Number allows you to send simple text/template messages to up to 5 verified tester phones, but **Flows are restricted** and require the underlying business to be verified.

---

## 2. Handing Off Meta Verification to Someone Else

If you want someone else (like a team member or a hired freelancer) to handle the verification process for you, you need to invite them to your **Meta Business Portfolio** and your **Meta Developer App** and grant them Admin access.

### Step 1: Invite them to your Meta Business Suite
They need to be an Admin in your Business Suite to submit legal documents on your behalf.
1. Go to your [Meta Business Settings](https://business.facebook.com/settings).
2. On the left sidebar under **Users**, click on **People**.
3. Click the **Invite People** (or **Add**) button.
4. Enter the email address of the person helping you.
5. In the permissions screen, you **must** grant them **Full Control / Admin access** (they cannot complete business verification with basic employee access).
6. Click **Next** and send the invitation. 

### Step 2: Add them to your Meta Developer App (Optional)
If they are also setting up your WhatsApp API, submitting App Review, or fixing the "Integrity Requirements", they need access to the developer app itself.
1. Go to the [Meta for Developers Dashboard](https://developers.facebook.com/apps/) and select your app.
2. On the left sidebar, click **App Roles** > **Roles**.
3. Click **Add People**.
4. Select **Administrator** (or Developer).
5. Enter their Facebook account name or Facebook Developer ID and click Add.

---

## 3. The Verification Checklist (For the Delegate)

*You can copy/paste this section directly to the person handling the verification.*

**Documents to Prepare:**
Meta is very strict. The **Business Name** and **Address** entered must exactly match the documents uploaded.

**A. Proof of Legal Business Name (Need ONE of the following):**
* Certificate of Incorporation / Formation
* Business License (issued by a city, county, or state)
* VAT / Tax Registration Certificate
* Articles of Incorporation

**B. Proof of Address and Phone Number (Need ONE of the following):**
* Utility Bill (electricity, water, internet) in the business's name
* Bank Statement (financial figures can be blurred/redacted)
* Business Phone Bill
*(Note: The document must be dated within the last 12 months and clearly show the legal business name and address.)*

**How to Submit the Verification:**
1. Log in to the [Meta Business Suite](https://business.facebook.com/).
2. In the bottom left, click **Settings** (the gear icon) > **Business Settings**.
3. Scroll down on the left sidebar and click **Security Center**.
4. Under the "Business Verification" section, click **Start Verification**.
5. Enter the business details **exactly** as they appear on the legal documents.
6. Upload the Proof of Legal Name and Proof of Address.
7. Choose a verification method (email to the official business domain, e.g., `admin@yourcompany.com`, or via phone/text).
8. Submit the application. Meta typically takes 10 minutes to 3 business days to review.
