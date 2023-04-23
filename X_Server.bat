@echo off

cd C:\Users\사용자이름\TavernAI-extras

python server.py --enable-modules=caption,classify,summarize --classification-model=joeddav/distilbert-base-uncased-go-emotions-student --summarization-model=Qiliang/bart-large-cnn-samsum-ChatGPT_v3 --captioning-model=Salesforce/blip-image-captioning-large --share

pause