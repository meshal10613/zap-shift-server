# Project Name: ZapShift

- [Client Live URL](http://localhost:5173/)
- [Server Live URL](http://localhost:3000/)

## Project Purpose: ZapShift

ZapShift is a parcel delivery management platform designed to streamline the logistics process for both businesses and individuals. It connects users, riders (delivery personnel), and admins through a centralized system, allowing for efficient, transparent, and trackable parcel delivery services. The platform eliminates manual processes, improves real-time coordination, and enhances the customer experience with faster and more reliable deliveries.

## 🔑 Key Features of ZapShift

### 👤 User Features:
- User Registration/Login: Secure authentication system for parcel senders.

- Parcel Booking: Easily create a delivery request with parcel details and destination.

- Real-Time Tracking: Track the delivery status and location of parcels.

- Payment System: Pay delivery charges and view payment history (Paid/Unpaid status).

- Parcel History: View all previously sent parcels with status and cost.

### 🧍‍♂️ Rider Features:
- Rider Dashboard: Access assigned deliveries with parcel details and user contact info.

- Update Delivery Status: Change the status of the parcel (Picked up, In transit, Delivered).

- Location Update: Share current location (for tracking purposes).

- Daily Summary: View daily parcel count and earnings summary.

### 🛠️ Admin Features:
- User & Rider Management: Add, edit, or remove users and riders.

- Parcel Oversight: Monitor all active/inactive parcels, statuses, and payment information.

- Analytics Dashboard: View delivery stats, revenue, and performance indicators.

- Region & Warehouse Management: Assign riders to specific regions or warehouses.

- Manual Overrides: Update parcel status or assign riders manually if needed.

### ⚙️ Technical Highlights:
- Backend: Express.js with MongoDB for scalable API and database operations.

- Security: Environment variables managed with dotenv, CORS for secure cross-origin requests.

- Role-Based Access Control: Separate features and permissions for Admin, Rider, and User.

- Responsive Design (Frontend): (Assuming you're using React) User-friendly interface for all device sizes.

## Dependencies

- express js - [5.1.0](https://expressjs.com/)
- mongo db - [6.16.0](https://www.mongodb.com/)
- dotenv - [16.5.0](https://www.npmjs.com/package/dotenv)
- cors - [2.8.5](https://www.npmjs.com/package/cors)

## 🚀 Getting Started

To get the backend server up and running on your local machine, follow these simple steps.

### Prerequisites

Make sure you have **Node.js** and **npm** installed. **MongoDB** should also be installed and running.

* **Node.js & npm:**
    ```bash
    npm install npm@latest -g
    ```
* **MongoDB:** [Install MongoDB](https://docs.mongodb.com/manual/installation/)

### Running the Server

1.  Create a **`.env`** file in the root of your project and add your environment variables:
    ```env
    PORT=3000
    DB_USER=your_mongodb_username
    DB_PASS=your_mongodb_password
    ```
    * `PORT`: The port your backend server will run on (defaulting to 3000 if not specified).
    * `DB_USER` & `DB_PASS`: Your MongoDB Atlas cluster username and password.
    * `NODE_ENV`: Set to `production` in production environments for secure cookie handling (`secure` and `sameSite` settings).
2.  Start the backend server:
    ```bash
    npm start
    ```
    The server will typically run on the port specified in your `.env` file (e.g., `http://localhost:3000`).

---

## 🗺️ API Endpoints

Here's a detailed overview of the API endpoints provided by this backend:

| Method | Endpoint | Description | Authentication |
| :------- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- |
| `GET` | `/parcels` | Retrieves a list of all parcels | Public |
| `POST` | `/parcels` | Creates a new parcel in the database | Privet |
| `DELETE` | `/parcels/:id` | Delete a particuler parcel | Privet |
| | This project is running | More APIs will added |

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📞 Contact

Syed Mohiuddin Meshal - syedmohiuddinmeshal24@gmail.com