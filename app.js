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

main().then(() => {
    console.log("connected to db");
}).catch(err => console.log(err));

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/miniproject');
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
    res.render("mainpage.ejs" ,{user:{username: username}}); 
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
