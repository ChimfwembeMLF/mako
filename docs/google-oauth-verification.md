# Google OAuth verification — Mako submission kit

For whoever submits the app in Google Cloud Console. Check every scope's class against
Google's current scope list before submitting, because Google reclassifies scopes.

## 1. What Mako requests

| Feature | Scope | Likely class | Review needed |
|---|---|---|---|
| Sign-in | `openid`, `email`, `profile` | Non-sensitive | Brand verification |
| Gmail | `gmail.readonly` | Restricted | Verification plus security assessment |
| Gmail | `gmail.compose` | Restricted | Verification plus security assessment |
| Gmail | `gmail.send` | Sensitive | Verification |
| Drive | `drive.readonly` | Restricted | Verification plus security assessment |
| YouTube | `youtube.readonly`, `youtube.upload`, `youtube.force-ssl` | Sensitive | Verification, including a demo video |
| Google Ads | `adwords` | Sensitive | Verification, plus a separate Google Ads API developer token |

Restricted scopes need a yearly CASA security assessment from an approved lab, paid for by you.

## 2. Recommended order

1. **Now:** verify sign-in, YouTube and Google Ads. These need no security assessment.
2. **Drive:** replace `drive.readonly` with `drive.file` and the Google Picker. Mako only imports
   files the user chooses, so this should remove Drive from the assessment. Needs a code change.
3. **Gmail:** submit last, with the security assessment. Until then, Gmail connections show
   Google's unverified warning and are capped at 100 users.

## 3. Before submitting

- [ ] Deploy the updated privacy policy (Google user data and Limited Use sections).
- [ ] Confirm each AI provider's terms don't allow training on API data, because the policy says
      Google data isn't used to train models.
- [ ] Decide whether DeepSeek stays available for workspaces with Gmail auto-reply.
- [ ] Pick one public name. The site title says "Mako Market" but `APP_NAME` says
      "Tekrem Innovation Solutions - Mako". The consent screen name must match the home page.
- [ ] Verify `mako.tekreminnovations.com` in Google Search Console, using an account that is an
      owner or editor of the Cloud project.
- [ ] Use a support email you control. Prefer one on your own domain to `tekremsolutions@gmail.com`.
- [ ] Confirm the home page explains what Mako does and links to the privacy policy without login.
- [ ] Remove any scope from the consent screen that Mako doesn't use.
- [ ] Make a test account for Google's reviewers.

## 4. Consent screen values

| Field | Value |
|---|---|
| Home page | `https://mako.tekreminnovations.com` |
| Privacy policy | `https://mako.tekreminnovations.com/privacy` |
| Terms of service | `https://mako.tekreminnovations.com/terms` |
| Authorized domain | `tekreminnovations.com` |

## 5. Scope justifications (paste into the form)

**gmail.readonly**: Mako's Email inbox shows a business's incoming Gmail messages alongside its
social messages, so a team can answer customers in one place. Messages are read and stored to display
them. If the user turns on auto-reply, message text is sent to the workspace's AI provider to draft a
reply. A narrower scope wouldn't work because the feature needs full message content.

**gmail.compose**: Creates reply drafts in the connected mailbox, so a user can review a reply in
Gmail before sending it.

**gmail.send**: Sends replies from the user's own address, either written by the user or generated
by auto-reply rules the user turned on.

**drive.readonly**: Lets a user browse their Drive and import a chosen file into the Mako media
library for use in posts. Only selected files are copied.

**youtube.upload**: Publishes videos the user creates or schedules in Mako to their channel.

**youtube.readonly**: Shows the connected channel, its videos and performance.

**youtube.force-ssl**: Reads and replies to comments on the user's videos from the Mako inbox.

**adwords**: Lets a user create, pause and measure Google Ads campaigns from Mako.

## 6. Demo video

Unlisted YouTube link, in English, with the browser address bar visible. Show one take per feature.

1. Open the home page, then the privacy policy.
2. Click Connect and show the Google consent screen, with the **app name and client ID** visible.
3. Grant access and show the app using each scope:
   - **Gmail:** a message appears in the Email inbox, send a reply, show it in Gmail, turn on auto-reply.
   - **Drive:** browse files, import one, show it in the media library.
   - **YouTube:** publish a video, show it on the channel, reply to a comment.
   - **Google Ads:** create and pause a campaign, show metrics.
4. Disconnect, and show where data can be deleted.

## 7. Submit

Google Cloud Console → Google Auth Platform → Branding, Audience and Data Access → **Publish app**,
then **Prepare for verification**. Reply promptly to email from the review team: requests left
unanswered can stall the application.
