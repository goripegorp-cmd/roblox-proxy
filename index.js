const express = require("express");
const app = express();

// Check if player follows another user
app.get("/followings/:userId", async (req, res) => {
  const { userId } = req.params;
  const cursor = req.query.cursor || "";
  const url = `https://friends.roblox.com/v1/users/${userId}/followings?limit=100&sortOrder=Desc${cursor ? "&cursor=" + cursor : ""}`;

  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json();
    res.set("Cache-Control", "no-store, no-cache");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if player is in a group
app.get("/ingroup/:userId/:groupId", async (req, res) => {
  const { userId, groupId } = req.params;
  const url = `https://groups.roblox.com/v2/users/${userId}/groups/roles`;

  try {
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json();
    const inGroup = data.data?.some(g => g.group.id === parseInt(groupId)) || false;
    res.json({ inGroup });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "roblox-proxy" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Roblox proxy running on port ${PORT}`);
});
