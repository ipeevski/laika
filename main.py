import uvicorn
from dotenv import load_dotenv

load_dotenv()


def main():
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)


###############################
# If executed directly        #
###############################
if __name__ == "__main__":
    main()
