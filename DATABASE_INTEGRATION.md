# Database Integration — User Profiles

## Overview
User credentials and profile information are stored in `profiles.json`, which serves as the website's database. Users cannot manually edit this file; all changes are made through the dashboard and automatically synced.

## Backend Setup

When users save their profile from the dashboard, the frontend calls `syncProfileToDatabase()` which sends profile data to your backend API.

### API Endpoint (to implement)
```
POST /api/profiles/save
Content-Type: application/json

{
  "role": "freelancer" | "client",
  "lastUpdated": "2026-03-08T12:00:00.000Z",
  "profile": {
    "name": "...",
    "title": "...",
    "bio": "...",
    ...all profile fields...
  }
}
```

## Backend Implementation Example (Node.js/Express)

```javascript
app.post('/api/profiles/save', (req, res) => {
  const { role, profile } = req.body;
  
  // Load current profiles.json
  let profilesData = JSON.parse(fs.readFileSync('profiles.json', 'utf8'));
  
  // Update the specific role profile
  profilesData[role] = profile;
  profilesData.lastUpdated = new Date().toISOString();
  
  // Save back to profiles.json
  fs.writeFileSync('profiles.json', JSON.stringify(profilesData, null, 2));
  
  res.json({ success: true, message: 'Profile saved' });
});
```

## Frontend Code to Enable

In `dashboard.html`, replace the `syncProfileToDatabase()` function's commented API call:

```javascript
function syncProfileToDatabase() {
  const p = profiles[currentRole];
  const profileData = {
    role: currentRole,
    lastUpdated: new Date().toISOString(),
    profile: p
  };

  fetch('/api/profiles/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData)
  }).then(res => res.json())
    .then(data => {
      if (data.success) {
        console.log('✓ Profile synced to database');
      } else {
        console.error('✗ Sync failed:', data.message);
      }
    })
    .catch(err => console.error('Sync error:', err));
}
```

## File Structure

```
CSS151-Project/
├── profiles.json           ← Database (Backend managed only)
├── css/
│   └── gighub.css
├── html/
│   ├── dashboard.html      ← User interface (calls syncProfileToDatabase)
│   ├── LandingPage.html
│   ├── signup.html
│   └── login.html
└── Images/
    └── GIGHUBLOGO ONLY.PNG
```

## Profile Fields

### Both Roles Include:
- name, title, bio
- languages, location
- skill, tools, level, years
- payment, degree, institution, gradYear, certs
- portfolioFile, portfolioFileName, avatarSrc

### Freelancer-Specific:
- hourly, fixedMin, fixedMax

### Client-Specific:
- payment (credit card preferred)

## Database Updates

- **When**: Every time a user saves their profile from the dashboard
- **What**: All fields for the current role (freelancer or client)
- **How**: Automatic API call via `syncProfileToDatabase()`
- **File Updated**: `profiles.json`

## Important Notes

✓ Users edit profiles in the dashboard UI
✓ Changes automatically sync to profiles.json via backend API
✓ Each role has independent profile data
✓ Portfolio PDFs and avatars are stored as object URLs in browser
✓ For production, implement file upload API to store images/PDFs on server

## Testing

To test profile sync locally without backend:
1. Open dashboard
2. Click Edit on profile
3. Update fields and click Save
4. Check browser console for: "✓ Profile synced to database"
5. Implement backend API to actually persist to profiles.json
