import bcrypt

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password, hashed_password):
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"Error in verify_password: {e}")
        return False

# Test
password = "testpassword"
hashed = get_password_hash(password)
print(f"Password: {password}")
print(f"Hashed: {hashed}")
print(f"Match: {verify_password(password, hashed)}")

# Test with a hash from the user's DB
db_hash = "$2b$12$Y23umtbkKNysp/EjF1L0ouJUnErPYAh9oRkThZ0NmqA.Jn1bzAkmC"
print(f"Match with DB hash (assuming password is '123456'): {verify_password('123456', db_hash)}")
