import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Definir o schema do usuário
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Método para criptografar a senha antes de salvar o usuário
userSchema.pre('save', async function(next) {
  // Só criptografa a senha se foi modificada ou é nova
  if (!this.isModified('password')) return next();
  
  try {
    // Gerar um salt
    const salt = await bcrypt.genSalt(10);
    // Criptografar a senha
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;