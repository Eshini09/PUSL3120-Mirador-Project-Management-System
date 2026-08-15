const express = require("express");
const app = express();
const PORT = 5001;
app.get("/api/health", (req, res) => {
    res.json({
            status: "OK"
        });
});
app.listen(PORT, () => {
    console.log(`Mirador server running on port ${PORT}`);
});