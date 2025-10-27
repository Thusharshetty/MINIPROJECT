const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;
const mongoose = require('mongoose');
const User = require('./modles/user'); // Assuming the path is './modles/user'
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const bcrypt = require('bcrypt'); // Note: This library is imported but not used for hashing/comparison yet.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const multer = require('multer');
const storage = multer.memoryStorage(); // Use memory storage for quick API processing
const upload = multer({ storage: storage });
const dotenv = require('dotenv'); 
dotenv.config();
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

main().then(() => {
    console.log("connected to db");
}).catch(err => console.log(err));

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/miniproject');
}
app.post('/api/classify_waste', upload.single('wasteImage'), async (req, res) => {
    
    // Check if a file was uploaded
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No image file uploaded." });
    }

    // 1. Prepare image and prompt for Gemini
    const imagePart = fileToGenerativePart(req.file.buffer, req.file.mimetype);
    
    // This structured prompt ensures the model returns a predictable JSON response.
    const prompt = `Analyze the waste object in this image. Classify it strictly into one of these types: 'Plastic', 'Organic', 'Recyclable', or 'E-Waste'. 
    Then, provide disposal guidance, a recycling potential percentage (1-100), and a step-by-step process if it is 'E-Waste'. 
    
    Respond STRICTLY in the following JSON format ONLY:
    {
      "classification": "ClassificationType",
      "guidance": "Detailed disposal instructions.",
      "recyclingPotential": Number,
      "isEwaste": Boolean,
      "eWasteProcess": ["Step 1", "Step 2", "Step 3"] // Use empty array if not E-Waste
    }`;

    try {
        // 2. Call the Gemini API
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Good for multimodal tasks
            contents: [
                { role: "user", parts: [imagePart, { text: prompt }] }
            ],
            // Request JSON output
            config: {
                responseMimeType: "application/json", 
            }
        });

        // 3. Parse and Validate Response
        const jsonText = response.text.trim().replace(/```json|```/g, ''); // Clean surrounding markdown
        const geminiResult = JSON.parse(jsonText);
        
        // Map Gemini classification to your existing frontend styles
        let styleClass;
        switch (geminiResult.classification.toLowerCase()) {
            case 'plastic':
                styleClass = 'plastic';
                break;
            case 'organic':
                styleClass = 'bio';
                break;
            case 'recyclable':
                styleClass = 'recyclable';
                break;
            case 'e-waste':
                styleClass = 'e-waste';
                break;
            default:
                styleClass = 'recyclable'; // Default to general recyclable
        }
        
        // MOCK LOCATION DATA (This is still mock, as real location requires a separate API)
        const mockCenters = [
            // ... (Your existing mockCenters list) ...
            { name: "Green Earth Recycling Center", address: "123 Eco Street, Mangalore", contact: "+91 98765 43210", accepts: "Plastic, Paper, Metal, E-Waste", isEwasteSpecialist: false },
            { name: "E-Waste Solutions Hub", address: "456 Tech Park, Mangalore", contact: "+91 87654 32109", accepts: "Specializes in electronic waste recycling", isEwasteSpecialist: true }
        ];

        const isEwaste = geminiResult.classification.toLowerCase() === 'e-waste';
        const nearbyCenters = isEwaste 
            ? mockCenters.filter(c => c.isEwasteSpecialist)
            : mockCenters.filter(c => c.accepts.includes(geminiResult.classification) || !c.isEwasteSpecialist);

        // 4. Send the structured response back to the frontend
        res.json({
            success: true,
            classification: geminiResult.classification,
            styleClass: styleClass,
            guidance: geminiResult.guidance,
            recyclingPotential: geminiResult.recyclingPotential || 75, // Provide fallback
            nearbyCenters: nearbyCenters,
            eWasteProcess: geminiResult.eWasteProcess || [],
        });

    } catch (error) {
        console.error("Gemini API or Parsing Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "AI classification failed or returned an invalid format.", 
            details: error.message 
        });
    }
});
function fileToGenerativePart(buffer, mimeType) {
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}
// GET Routes to serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signin.html')); // Changed from signin.html for clarity
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/main_app_page', (req, res) => {
    const username= req.query.username;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    res.render("mainpage.ejs" ,{user:{username: username},mapsKey: mapsKey}); 
});
app.get('/logout',(req,res)=>{
    res.redirect('/');
})

// POST Route for SIGNUP
app.post('/signup', async (req, res) => {
    // 1. TRIM and CLEAN data immediately
    const username = req.body.username ? req.body.username.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';
    const confirm_password = req.body.confirm_password ? req.body.confirm_password.trim() : '';
    
    // Check for required fields
    if (!username || !password || !confirm_password) {
        const errorMessage = encodeURIComponent('Error: All fields are required for signup.');
        return res.redirect(`/signup?error=${errorMessage}`);
    }
    
    // Server-side check for confirm password match (USER REQUESTED POPUP HERE)
    if (password !== confirm_password) {
        const errorMessage = encodeURIComponent('Error: Passwords do not match. Please try again.');
        return res.redirect(`/signup?error=${errorMessage}`); 
    }
    
    try {
        // Find existing user
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            const errorMessage = encodeURIComponent('Error: Username already exists. Try logging in or use a different name.');
            return res.redirect(`/signup?error=${errorMessage}`); 
        }

        // --- Note: Add bcrypt hashing here for production ---
        const newUser = new User({ 
            username: username, 
            password: password 
        });
        
        await newUser.save();
        
        // Success: Redirect to the login page with a success message
        const successMessage = encodeURIComponent('Account created successfully! Please log in.');
        res.status(201).redirect(`/login?success=${successMessage}`); 
        
    } catch (error) {
        console.error("Signup error:", error);
        const errorMessage = encodeURIComponent('An unexpected error occurred during signup.');
        res.redirect(`/signup?error=${errorMessage}`);
    }
});

// POST Route for LOGIN
app.post('/login', async (req, res) => {
    const username = req.body.username ? req.body.username.trim().toLowerCase() : '';
    const password = req.body.password ? req.body.password.trim() : '';

    if (!username || !password) {
        const errorMessage = encodeURIComponent('Login Failed: Both username and password are required.');
        return res.redirect(`/login?error=${errorMessage}`);
    }

    try {
        const user = await User.findOne({ username });

        // Check if user exists OR if password comparison fails (USER REQUESTED POPUP HERE)
        const isMatch = (user && password === user.password); // Simple comparison

        if (!user || !isMatch) { 
             const errorMessage = encodeURIComponent('Login Failed: Invalid username or password.');
             return res.redirect(`/login?error=${errorMessage}`);
        }

        // Success: User is authenticated. 
        // In a real app, you would set a session/cookie here.
        res.redirect('/main_app_page?username=' + encodeURIComponent(user.username)); 

    } catch (error) {
        console.error("Login error:", error);
        const errorMessage = encodeURIComponent('An unexpected error occurred during login.');
        res.redirect(`/login?error=${errorMessage}`);
    }
});

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});
