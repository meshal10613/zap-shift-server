require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@meshal10613.mbbtx0s.mongodb.net/?retryWrites=true&w=majority&appName=meshal10613`;

app.get("/", async(req, res) => {
    res.send("Server is running...");
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const userCollection = client.db("zap-shift").collection("users");
        const parcelCollection = client.db("zap-shift").collection("parcels");

        // parcelCollection
        app.get("/parcels", async(req, res) => {
            try{
                const {email} = req.query;
                const query = email ? { created_by: email } : {};
                const options = {
                    sort: { creation_date: -1 } //sort by latest first
                }
                const result = await parcelCollection.find(query, options).toArray();
                res.send(result);
            }catch(error){
                console.log("Error inserting percel:", error);
                res.status(500).send({ message: "Failed to get percel" })
            }
        });

        app.post("/parcels", async(req, res) => {
            try{
                const newParcel = req.body;
                const result = await parcelCollection.insertOne(newParcel);
                res.status(201).send(result);
            }catch (error){
                console.log("Error inserting percel:", error);
                res.status(500).send({ message: "Failed to create a percel" })
            }
        });

        app.delete("/parcels/:id", async(req, res) => {
            const {id} = req.params;
            const query = { _id: new ObjectId(id) }
            const result = await parcelCollection.deleteOne(query);
            res.send(result);
        });

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});