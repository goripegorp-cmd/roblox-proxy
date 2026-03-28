const express = require("express");
const app = express();

// ==========================================
// CHECK FOLLOWINGS (paginated)
// GET /followings/:userId
// ==========================================
app.get("/followings/:userId", async (req, res) => {
  const { userId } = req.params;
  const cursor = req.query.cursor || "";
  const url = `https://friends.roblox.com/v1/users/${userId}/followings?limit=100&sortOrder=Desc${cursor ? "&cursor=" + cursor : ""}`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await response.json();
    res.set("Cache-Control", "no-store, no-cache");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CHECK IF USER FOLLOWS SPECIFIC TARGETS
// GET /check-follows/:userId?targets=123,456,789
// Returns: { "123": true, "456": false, "789": true }
// ==========================================
app.get("/check-follows/:userId", async (req, res) => {
  const { userId } = req.params;
  const targets = (req.query.targets || "").split(",").map(Number).filter(Boolean);
  if (targets.length === 0) return res.json({ error: "No targets" });

  const targetSet = new Set(targets);
  const results = {};
  targets.forEach(t => results[t] = false);

  let cursor = "";
  let pages = 0;

  try {
    while (pages < 10) {
      pages++;
      const url = `https://friends.roblox.com/v1/users/${userId}/followings?limit=100&sortOrder=Desc${cursor ? "&cursor=" + cursor : ""}`;
      const response = await fetch(url, { headers: { "Accept": "application/json" } });
      const data = await response.json();

      if (data && data.data) {
        for (const entry of data.data) {
          if (targetSet.has(entry.id)) {
            results[entry.id] = true;
          }
        }

        // Early exit if all targets found
        if (targets.every(t => results[t])) break;

        if (data.nextPageCursor) {
          cursor = data.nextPageCursor;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    res.set("Cache-Control", "no-store, no-cache");
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CHECK GROUP MEMBERSHIP
// GET /ingroup/:userId/:groupId
// Returns: { inGroup: true/false }
// ==========================================
app.get("/ingroup/:userId/:groupId", async (req, res) => {
  const { userId, groupId } = req.params;
  const url = `https://groups.roblox.com/v2/users/${userId}/groups/roles`;

  try {
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await response.json();
    const inGroup = data.data?.some(g => g.group.id === parseInt(groupId)) || false;
    res.set("Cache-Control", "no-store, no-cache");
    res.json({ inGroup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CHECK GAME FAVORITE
// GET /favorite/:userId/:universeId
// Returns: { isFavorited: true/false }
// ==========================================
app.get("/favorite/:userId/:universeId", async (req, res) => {
  const { userId, universeId } = req.params;
  const url = `https://games.roblox.com/v1/games/${universeId}/favorites`;

  try {
    // This endpoint checks total favorites, not per-user
    // Per-user favorite check requires auth — use vote endpoint as proxy
    const voteUrl = `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`;
    const response = await fetch(voteUrl, { headers: { "Accept": "application/json" } });
    const data = await response.json();
    // Can't check per-user favorites without auth — return game info
    res.set("Cache-Control", "no-store, no-cache");
    res.json({ gameExists: true, data: data.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ALL-IN-ONE CHECK (follow + group + everything)
// GET /check-all/:userId?targets=123,456,789&groupId=234696053
// Returns: { follows: {123: true, 456: false}, inGroup: true }
// ==========================================
app.get("/check-all/:userId", async (req, res) => {
  const { userId } = req.params;
  const targets = (req.query.targets || "").split(",").map(Number).filter(Boolean);
  const groupId = parseInt(req.query.groupId) || 0;

  const result = { follows: {}, inGroup: false };

  try {
    // Check follows (parallel-safe)
    const followPromise = (async () => {
      targets.forEach(t => result.follows[t] = false);
      if (parseInt(userId) && targets.length > 0) {
        const targetSet = new Set(targets);
        let cursor = "";
        let pages = 0;
        while (pages < 10) {
          pages++;
          const url = `https://friends.roblox.com/v1/users/${userId}/followings?limit=100&sortOrder=Desc${cursor ? "&cursor=" + cursor : ""}`;
          const resp = await fetch(url, { headers: { "Accept": "application/json" } });
          const data = await resp.json();
          if (data && data.data) {
            for (const entry of data.data) {
              if (targetSet.has(entry.id)) result.follows[entry.id] = true;
            }
            if (targets.every(t => result.follows[t])) break;
            if (data.nextPageCursor) cursor = data.nextPageCursor;
            else break;
          } else break;
        }
      }
    })();

    // Check group (parallel)
    const groupPromise = (async () => {
      if (groupId > 0) {
        const url = `https://groups.roblox.com/v2/users/${userId}/groups/roles`;
        const resp = await fetch(url, { headers: { "Accept": "application/json" } });
        const data = await resp.json();
        result.inGroup = data.data?.some(g => g.group.id === groupId) || false;
      }
    })();

    // Run both in parallel
    await Promise.all([followPromise, groupPromise]);

    res.set("Cache-Control", "no-store, no-cache");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "roblox-proxy", endpoints: ["/followings/:id", "/check-follows/:id?targets=1,2,3", "/ingroup/:id/:groupId", "/check-all/:id?targets=1,2,3&groupId=123"] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Roblox proxy running on port ${PORT}`);
});
