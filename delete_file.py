import os

file_to_delete = 'C:/Users/ranci/Desktop/CypMail/create_dir.py'
if os.path.exists(file_to_delete):
    os.remove(file_to_delete)
    print(f'File {file_to_delete} deleted.')
else:
    print(f'File {file_to_delete} does not exist.')