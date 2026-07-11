Meta's APIs are **far more capable** than LinkedIn's, especially for businesses. If Mako is positioning itself as an AI marketing platform, Facebook and Instagram should be your primary focus because they expose a much richer set of capabilities.

## Facebook

### Read

With the appropriate permissions, you can retrieve:

✅ User profile (basic information)

✅ Pages the user manages

✅ Page details (name, category, description)

✅ Page profile picture

✅ Page cover photo

✅ Followers/Likes

✅ Posts

✅ Comments

✅ Reactions

✅ Videos

✅ Photos

✅ Events (limited)

✅ Insights/analytics

✅ Messenger conversations (with Messenger permissions)

---

### Create

You can:

* Publish posts
* Upload photos
* Upload videos
* Publish links
* Schedule posts (depending on the API/feature)
* Reply to comments
* Reply to Messenger messages
* Moderate comments
* Hide/delete comments
* Send Messenger messages (within platform rules)

---

### Edit

For Pages (not personal profiles), you can edit some metadata, depending on permissions:

* Description
* Business hours
* Contact information
* Call-to-action button
* Certain Page settings

You **cannot** arbitrarily edit everything.

---

### Analytics

You can retrieve:

* Reach
* Impressions
* Engagement
* Followers gained/lost
* Video views
* Post performance
* Audience demographics
* Click-through rates

---

## Instagram (Business & Creator Accounts)

Instagram is one of Meta's strongest APIs.

### Read

You can access:

* Username
* Bio
* Profile picture
* Followers
* Following count
* Media
* Reels
* Stories (limited)
* Comments
* Mentions
* Tagged media
* Insights
* Hashtag search

---

### Publish

You can publish:

✅ Images

✅ Carousels

✅ Reels

✅ Videos

Then optionally publish immediately or after preparing the media container.

---

### Manage

You can:

* Reply to comments
* Delete comments
* Hide comments
* Read mentions
* Moderate interactions

---

### Analytics

You can retrieve:

* Reach
* Accounts reached
* Accounts engaged
* Saves
* Shares
* Likes
* Comments
* Reel plays
* Story metrics
* Audience demographics
* Follower growth

---

## Personal Profile Editing

This is where expectations need adjusting.

### Facebook Personal Profile

You **cannot** edit:

* Name
* Bio
* Friends
* Timeline
* Photos
* Personal profile details

Meta intentionally keeps personal profiles off-limits.

---

### Instagram Profile

The API allows reading certain profile information for Business/Creator accounts, but **editing profile fields like the bio or profile picture is generally not supported through the public Graph API**. Users still make those changes directly in Instagram.

---

# Messenger

With the proper permissions:

* Read messages
* Send messages
* Build chatbots
* Human handoff
* Quick replies
* Templates
* Attachments

---

# WhatsApp Business

The WhatsApp Business Platform is very capable:

* Send messages
* Receive messages
* Media
* Documents
* Templates
* Interactive buttons
* Lists
* Authentication messages
* Flows
* AI assistants
* Conversation history
* Webhooks

---

# For Mako

A strong feature set would look like this:

### Social Management

* Connect Facebook Pages
* Connect Instagram Business accounts
* Connect WhatsApp Business

### AI Content

* Generate captions
* Generate hashtags
* Create posting schedules
* Recommend optimal posting times

### Publishing

* Cross-post to Facebook and Instagram
* Publish images
* Publish videos
* Publish Reels
* Publish carousels

### Community Management

* Unified inbox
* Comment moderation
* Reply suggestions
* AI-assisted responses
* Messenger and WhatsApp support

### Analytics

* Engagement dashboards
* Reach and impressions
* Follower growth
* Content performance
* Best posting times
* Campaign reporting

### AI Layer

* Analyze post performance
* Suggest content improvements
* Predict engagement trends
* Recommend posting frequency
* Generate reports

---

## Comparison

| Feature        | LinkedIn     | Facebook Pages           | Instagram Business                |
| -------------- | ------------ | ------------------------ | --------------------------------- |
| Read profile   | Limited      | Limited                  | Yes                               |
| Edit profile   | No           | Limited (Page info only) | Very limited                      |
| Create posts   | Yes          | Yes                      | Yes                               |
| Schedule posts | Yes          | Yes                      | Yes                               |
| Upload images  | Yes          | Yes                      | Yes                               |
| Upload videos  | Yes          | Yes                      | Yes                               |
| Reels          | No           | Yes                      | Yes                               |
| Stories        | No           | Limited                  | Limited                           |
| Comments       | Yes          | Yes                      | Yes                               |
| Messaging      | Partner only | Yes (Messenger)          | Limited (Instagram Messaging API) |
| Analytics      | Yes          | Yes                      | Yes                               |

The important distinction is that Meta's APIs are designed around **business assets** such as Facebook Pages, Instagram Business or Creator accounts, and WhatsApp Business accounts. Personal Facebook profiles and standard Instagram accounts remain intentionally restricted for privacy and platform integrity.
