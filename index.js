const express = require('express');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp, getDoc, deleteDoc, doc, getDocs } = require('firebase/firestore');
const cron = require('node-cron');

const app = express();

// Config: Firebase (Yes, it is a bad idea to put the config here, but I'm too lazy to do it properly)
const firebaseConfig = {
    apiKey: "AIzaSyDx0OTZNXZpWoryTNDztpjbIYchl8RWkio",
    authDomain: "noteguard-11e6b.firebaseapp.com",
    projectId: "noteguard-11e6b",
    storageBucket: "noteguard-11e6b.appspot.com",
    messagingSenderId: "279384935879",
    appId: "1:279384935879:web:e5c704bff8ca2a032adde2"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.use(express.urlencoded({ extended: true }));
app.use('/media', express.static('media'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Auto Deleting At 00:00
cron.schedule('0 0 * * *', async () => {
    console.log('Running automatic expiration check...');

    try {
        const notesCollection = collection(db, 'notes');
        const notesSnapshot = await getDocs(notesCollection);
        const currentDate = new Date();
        notesSnapshot.forEach(async (noteDoc) => {
            const noteData = noteDoc.data();

            if (noteData.expirationDate.toDate() < currentDate) {
                await deleteDoc(doc(db, 'notes', noteDoc.id));
                console.log(`Note with ID ${noteDoc.id} has expired and has been deleted.`);
            }
        });
    } catch (error) {
        console.error('Error checking and deleting expired notes:', error);
    }
}, { timezone: 'America/New_York' });

// Config: Express
app.get('/', (_, res) => {
    res.render('index', { error: null, success: null });
});

app.post('/createNote', async (req, res) => {
    const { title, content, expirationDate, password } = req.body;

    try {
        // Create a new note document in the 'notes' collection
        const docRef = await addDoc(collection(db, 'notes'), {
            title,
            content,
            expirationDate,
            password,
            createdAt: serverTimestamp(),
        });

        console.log('Note created with ID:', docRef.id);

        // Redirect to the 'noteCreated' page with the note ID
        res.redirect(`/noteCreated/${docRef.id}`);
    } catch (error) {
        console.error('Error creating the note:', error);
        // Redirect to the main page with an error message
        res.redirect('/?error=Error creating the note. Please try again.');
    }
});

app.get('/noteCreated/:id', (req, res) => {
    res.render('noteCreated', { noteId: req.params.id });
});


app.get('/note/:id', async (req, res) => {
    const noteId = req.params.id;

    try {
        const noteRef = doc(db, 'notes', noteId);
        const noteSnapshot = await getDoc(noteRef);

        if (noteSnapshot.exists()) {
            const note = noteSnapshot.data();

            if (note.password) {
                res.render('enterPassword', { noteId });
            } else {
                res.render('viewNote', { note, authenticated: false });
            }
        } else {
            res.status(404).send('Note not found');
        }
    } catch (error) {
        console.error('Error fetching the note:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/verifyPassword/:id', async (req, res) => {
    const noteId = req.params.id;
    const { password } = req.body;

    try {
        const noteRef = doc(db, 'notes', noteId);
        const noteSnapshot = await getDoc(noteRef);

        if (noteSnapshot.exists()) {
            const note = noteSnapshot.data();

            if (password === note.password) {
                res.render('viewNote', { note, authenticated: true });
            } else {
                res.redirect(`/note/${noteId}?error=Incorrect password`);
            }
        } else {
            res.status(404).send('Note not found');
        }
    } catch (error) {
        console.error('Error fetching the note:', error);
        res.status(500).send('Internal Server Error');
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
