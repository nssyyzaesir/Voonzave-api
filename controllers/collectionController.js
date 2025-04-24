
const db = require('../firebase/connection');

const saveCollection = async (req, res) => {
  try {
    const { uid } = req.body;
    const data = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
      uid
    };
    
    await db.collection('collections').add(data);
    res.status(201).json({ message: 'Data saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getStatus = async (req, res) => {
  try {
    const { uid } = req.params;
    const snapshot = await db.collection('collections')
      .where('uid', '==', uid)
      .get();
    
    const data = snapshot.docs.map(doc => doc.data());
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const handleRedirect = async (req, res) => {
  try {
    const { uid } = req.params;
    await db.collection('clicks').add({
      uid,
      timestamp: new Date()
    });
    res.redirect('https://www.correios.com.br');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  saveCollection,
  getStatus,
  handleRedirect
};
