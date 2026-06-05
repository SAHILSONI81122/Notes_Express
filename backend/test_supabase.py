import os
from supabase import create_client

def test():
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    print(dir(supabase.storage.from_('test')))
    
if __name__ == "__main__":
    # We will just print the dir to see if the method exists.
    pass
