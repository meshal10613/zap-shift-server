require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.port || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
var admin = require("firebase-admin");


//middleware
app.use(cors());
app.use(express.json());

//custom middleware
const verifyFirebaseToken = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).status({message: "unauthorized access"});
    };
    const token = authHeader.split(" ")[1];
    if(!token){
        res.status(401).status({message: "unauthorized access"});
    };
    //verify token
    try{
        const decocded = await admin.auth().verifyIdToken(token);
        req.decocded = decocded;
        next();
    }catch(error){
        return res.status(403).send({message: "forbidden access"});
    }
};

const decocded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString("utf-8");
const serviceAccount = JSON.parse(decocded);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@meshal10613.mbbtx0s.mongodb.net/?retryWrites=true&w=majority&appName=meshal10613`;
const YOUR_DOMAIN = 'https://zap-shift-1b9b4.web.app';

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
        const paymentsCollection = client.db("zap-shift").collection("payments");
        const trackingCollection = client.db("zap-shift").collection("trackings");
        const ridersCollection = client.db("zap-shift").collection("riders");

        //verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req?.decocded?.email;
            const query = { email }
            const user = await userCollection.findOne(query);
            if (!user || user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        };

        //verify rider
        const verifyRider = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email }
            const user = await userCollection.findOne(query);
            if (!user || user.role !== 'rider') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        };

        // userCollection
        app.get("/users", async(req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get("/users/search", async (req, res) => {
            const emailQuery = req.query.email;
            if (!emailQuery) {
                return res.status(400).send({ message: "Missing email query" });
            }

            const regex = new RegExp(emailQuery, "i"); // case-insensitive partial match

            try {
                const users = await userCollection
                    .find({ email: { $regex: regex } })
                    // .project({ email: 1, createdAt: 1, role: 1 })
                    .limit(10)
                    .toArray();
                res.send(users);
            } catch (error) {
                console.error("Error searching users", error);
                res.status(500).send({ message: "Error searching users" });
            }
        });

        // GET: Get user role by email
        app.get('/users/:email/role', async (req, res) => {
            try {
                const email = req.params.email;

                if (!email) {
                    return res.status(400).send({ message: 'Email is required' });
                }

                const user = await userCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({ message: 'User not found' });
                }

                res.send({ role: user.role || 'user' });
            } catch (error) {
                console.error('Error getting user role:', error);
                res.status(500).send({ message: 'Failed to get role' });
            }
        });

        app.post("/users", async(req, res) => {
            const { email } = req.body;
            //chech user already exist or not
            const existUser = await userCollection.findOne({ email });
            if(existUser){
                const { lastSignInTime } = req.body;
                const query = { email: email };
                const updatedDoc = {
                    $set: {
                        lastSignInTime: lastSignInTime
                    }
                };
                const result = await userCollection.updateOne(query, updatedDoc);
                return res.status(200).send(result);
            };

            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.status(201).send(result);
        });

        app.patch("/users/:id/role", verifyFirebaseToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;

            if (!["admin", "user"].includes(role)) {
                return res.status(400).send({ message: "Invalid role" });
            }

            try {
                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role } }
                );
                res.send({ message: `User role updated to ${role}`, result });
            } catch (error) {
                console.error("Error updating user role", error);
                res.status(500).send({ message: "Failed to update user role" });
            }
        });

        // parcelCollection
        // app.get("/parcels",verifyFirebaseToken, async(req, res) => {
        //     try{
        //         const {email, payment_status, delivery_status} = req.query;
        //         const query = email ? { created_by: email } : {};
        //         const options = {
        //             sort: { creation_date: -1 } //sort by latest first
        //         }
        //         const result = await parcelCollection.find(query, options).toArray();
        //         res.send(result);
        //     }catch(error){
        //         console.log("Error getting percel:", error);
        //         res.status(500).send({ message: "Failed to get percel" })
        //     }
        // });

        app.get('/parcels', verifyFirebaseToken, async (req, res) => {
            try {
                const { email, payment_status, delivery_status } = req.query;
                let query = {}
                if (email) {
                    query = { created_by: email }
                }

                if (payment_status) {
                    query.payment_status = payment_status
                }

                if (delivery_status) {
                    query.delivery_status = delivery_status
                }

                const options = {
                    sort: { createdAt: -1 }, // Newest first
                };

                const parcels = await parcelCollection.find(query, options).toArray();
                res.send(parcels);
            } catch (error) {
                console.error('Error fetching parcels:', error);
                res.status(500).send({ message: 'Failed to get parcels' });
            }
        });

        app.get("/parcels/:id", async(req, res) => {
            try{
                const { id } = req.params;
                const query = { _id: new ObjectId(id) };
                const result = await parcelCollection.findOne(query);
                res.send(result);
            }catch(error){
                console.log("Error getting percel:", error);
                res.status(500).send({ message: "Failed to get percel" })
            }
        });

        app.get("/parcels/delivery/status-count", async(req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: "$delivery_status",
                        count: {$sum: 1}
                    }
                },
                {
                    $project: {
                        status: "$_id",
                        count: 1,
                        _id: 0
                    }
                }
            ];
            const result = await parcelCollection.aggregate(pipeline).toArray();
            res.send(result);
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

        app.patch("/parcels/:id/assign", async (req, res) => {
            const parcelId = req.params.id;
            const { riderId, riderName, riderEmail } = req.body;

            try {
                // Update parcel
                await parcelCollection.updateOne(
                    { _id: new ObjectId(parcelId) },
                    {
                        $set: {
                            delivery_status: "rider_assigned",
                            assigned_rider_id: riderId,
                            assigned_rider_email: riderEmail,
                            assigned_rider_name: riderName,
                        },
                    }
                );

                // Update rider
                await ridersCollection.updateOne(
                    { _id: new ObjectId(riderId) },
                    {
                        $set: {
                            work_status: "in_transit",
                        },
                    }
                );

                res.send({ message: "Rider assigned" });
            } catch (err) {
                console.error(err);
                res.status(500).send({ message: "Failed to assign rider" });
            }
        });

        app.patch("/parcels/:id/status", async (req, res) => {
            const parcelId = req.params.id;
            const { status } = req.body;
            const updatedDoc = {
                delivery_status: status
            }

            if (status === 'in_transit') {
                updatedDoc.picked_at = new Date().toISOString()
            }
            else if (status === 'delivered') {
                updatedDoc.delivered_at = new Date().toISOString()
            }

            try {
                const result = await parcelCollection.updateOne(
                    { _id: new ObjectId(parcelId) },
                    {
                        $set: updatedDoc
                    }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to update status" });
            }
        });

        app.patch("/parcels/:id/cashout", async (req, res) => {
            const id = req.params.id;
            const result = await parcelCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        cashout_status: "cashed_out",
                        cashed_out_at: new Date()
                    }
                }
            );
            res.send(result);
        });

        //paymentsCollection
        app.get('/payments', verifyFirebaseToken, async (req, res) => {

            try {
                const email = req.query.email;

                if(req.decocded.email !== email) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

                const query = email ? { email: email } : {};
                const options = { sort: { paid_at: -1 } }; // Latest first

                const payments = await paymentsCollection.find(query, options).toArray();
                res.send(payments);
            } catch (error) {
                console.error('Error fetching payment history:', error);
                res.status(500).send({ message: 'Failed to get payments' });
            }
        });

        // POST: Record payment and update parcel status
        app.post('/payments', async (req, res) => {
            try {
                const { id, email, amount, paymentMethod, transactionId } = req.body;

                // 1. Update parcel's payment_status
                const updateResult = await parcelCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            payment_status: 'paid'
                        }
                    }
                );

                if (updateResult.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Parcel not found or already paid' });
                }

                // 2. Insert payment record
                const paymentDoc = {
                    id,
                    email,
                    amount,
                    paymentMethod,
                    transactionId,
                    paid_at_string: new Date().toISOString(),
                    paid_at: new Date(),
                };

                const paymentResult = await paymentsCollection.insertOne(paymentDoc);

                res.status(201).send({
                    message: 'Payment recorded and parcel marked as paid',
                    insertedId: paymentResult.insertedId,
                });

            } catch (error) {
                console.error('Payment processing failed:', error);
                res.status(500).send({ message: 'Failed to record payment' });
            }
        });

        //trackingCollection
        // app.post("/tracking", async (req, res) => {
        //     const { tracking_id, parcel_id, status, message, updated_by = '' } = req.body;

        //     const log = {
        //         tracking_id,
        //         parcel_id: parcel_id ? new ObjectId(parcel_id) : undefined,
        //         status,
        //         message,
        //         time: new Date(),
        //         updated_by,
        //     };

        //     const result = await trackingCollection.insertOne(log);
        //     res.send({ success: true, insertedId: result.insertedId });
        // });
        app.get("/trackings/:trackingId", async (req, res) => {
            const trackingId = req.params.trackingId;

            const updates = await trackingCollection
                .find({ tracking_id: trackingId })
                .sort({ timestamp: 1 }) // sort by time ascending
                .toArray();

            res.json(updates);
        });

        app.post("/trackings", async (req, res) => {
            const update = req.body;

            update.timestamp = new Date(); // ensure correct timestamp
            if (!update.tracking_id || !update.status) {
                return res.status(400).json({ message: "tracking_id and status are required." });
            }

            const result = await trackingCollection.insertOne(update);
            res.status(201).json(result);
        });

        //payment
        app.post('/create-payment-intent', async (req, res) => {
            const { amountInCents, id } = req.body;
            console.log(id)
            const session = await stripe.paymentIntents.create({
                // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                amount: amountInCents, //amount in cents 
                currency: "bdt",
                payment_method_types: ['card'],
                // return_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
            });

            res.json({clientSecret: session.client_secret});
        });

        //ridersCollection
        app.get("/riders/pending", verifyFirebaseToken, verifyAdmin, async(req, res) => {
            try {
                const pendingRiders = await ridersCollection.find({ status: "pending" }).toArray();
                res.send(pendingRiders);
            } catch (error) {
                console.error("Failed to load pending riders:", error);
                res.status(500).send({ message: "Failed to load pending riders" });
            }
        });

        // GET: Get pending delivery tasks for a rider
        app.get('/rider/parcels', verifyFirebaseToken, async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({ message: 'Rider email is required' });
                }

                const query = {
                    assigned_rider_email: email,
                    delivery_status: { $in: ['rider_assigned', 'in_transit'] },
                };

                const options = {
                    sort: { creation_date: -1 }, // Newest first
                };

                const parcels = await parcelCollection.find(query, options).toArray();
                res.send(parcels);
            } catch (error) {
                console.error('Error fetching rider tasks:', error);
                res.status(500).send({ message: 'Failed to get rider tasks' });
            }
        });

        app.get('/rider/completed-parcels', verifyFirebaseToken, async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({ message: 'Rider email is required' });
                }

                const query = {
                    assigned_rider_email: email,
                    delivery_status: {
                        $in: ['delivered', 'service_center_delivered']
                    },
                };

                const options = {
                    sort: { creation_date: -1 }, // Latest first
                };

                const completedParcels = await parcelCollection.find(query, options).toArray();

                res.send(completedParcels);

            } catch (error) {
                console.error('Error loading completed parcels:', error);
                res.status(500).send({ message: 'Failed to load completed deliveries' });
            }
        });

        app.get("/riders/active", verifyFirebaseToken,verifyAdmin, async(req, res) => {
            try {
                const activeRiders = await ridersCollection.find({ status: "active" }).toArray();
                res.send(activeRiders);
            } catch (error) {
                console.error("Failed to load active riders:", error);
                res.status(500).send({ message: "Failed to load active riders" });
            }
        });

        app.get("/riders/deactivated", verifyFirebaseToken, async(req, res) => {
            try {
                const deactivateRiders = await ridersCollection.find({ status: "deactivated" }).toArray();
                res.send(deactivateRiders);
            } catch (error) {
                console.error("Failed to load deactivated riders:", error);
                res.status(500).send({ message: "Failed to load deactivated riders" });
            }
        });

        app.get("/riders/available", async (req, res) => {
            const { warehouse } = req.query;

            try {
                const riders = await ridersCollection
                    .find({
                        warehouse,
                        // status: { $in: ["approved", "active"] },
                        // work_status: "available",
                    })
                    .toArray();

                res.send(riders);
            } catch (err) {
                res.status(500).send({ message: "Failed to load riders" });
            }
        });
        
        app.post('/riders', async(req, res) => {
            const ridersData = req.body;
            const result = await ridersCollection.insertOne(ridersData);
            res.send(result);
        });

        app.patch('/riders/:id/status', async(req, res) => {
            const { id } = req.params;
            const { status, email } = req.body;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set:
                {
                    status
                }
            }

            try {
                const result = await ridersCollection.updateOne(
                    query, updateDoc
                );

                // update user role for accepting rider
                if (status === 'active') {
                    const userQuery = { email };
                    const userUpdateDoc = {
                        $set: {
                            role: 'rider'
                        }
                    };
                    const roleResult = await userCollection.updateOne(userQuery, userUpdateDoc)
                    console.log(roleResult.modifiedCount)
                }

                res.send(result);
            } catch (err) {
                res.status(500).send({ message: "Failed to update rider status" });
            }
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