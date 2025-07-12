from pathlib import Path
from typing import List, Optional
import os
import json
import uuid
import shutil

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from fastapi.responses import FileResponse

import litellm
from dotenv import load_dotenv

load_dotenv()


def main():
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)


###############################
# If executed directly        #
###############################
if __name__ == "__main__":
    main()
