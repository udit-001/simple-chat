import hashlib
import json
import os
import sqlite3
import time
from functools import wraps
from pprint import pprint

import eventlet
from flask import (
    Flask, jsonify, redirect, render_template, request, session, url_for)
from flask_bcrypt import Bcrypt
from flask_socketio import SocketIO, emit, join_room, leave_room
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from data import (ChannelExistsError, MaxChannelCreatedError, UserExistsError,
                  add_channel, add_user, connect, disconnect, get_channels,
                  get_md5, get_messages, get_users, send_message)
from flask_session import Session

SQLALCHEMY_DATABASE_URI = os.environ.get(
    'DATABASE_URL') or 'sqlite:///' + os.path.join(os.getcwd(), 'flack.db')

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app, manage_session=False)

app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"

Session(app)
bcrypt = Bcrypt(app)

# Set up database
engine = create_engine(SQLALCHEMY_DATABASE_URI)
db = scoped_session(sessionmaker(bind=engine))

# def convert(lst): return ({item[1]: item[0] for item in lst})


def convert(list_of_tuples): return [list(elem) for elem in list_of_tuples]


@app.route("/")
def index_page():
    if session.get('logged_in') == True:
        return redirect(url_for('chat_page'))
    return redirect(url_for('login_page'))


@app.route('/checkin')
def login_page():
    if 'logged_in' in session:
        return redirect(url_for('chat_page'))
    return render_template('login.html')


@app.route('/login', methods=["POST"])
def sql_login():
    if request.method == "POST":
        username = request.form['username']
        password = request.form['password']
        try:
            result = db.execute(
                'Select * from user WHERE username = :username', {'username': username}).fetchone()
            if result is not None:
                hashed = result[4]
                if bcrypt.check_password_hash(hashed, password):
                    session['username'] = username
                    session['logged_in'] = True
                    session['user_id'] = result[0]
                    return jsonify({'success': True, 'message': 'Signed in successfully!', 'username': username})
                else:
                    return jsonify({'success': False, 'message': 'Invalid username or password.'})

            else:
                return jsonify({'success': False, 'message': 'No account found, try signing up instead.'})
            print(result)
        except Exception as e:
            return e


@socketio.on('file upload')
def file_load(data):
    pprint(data)
    send_message(db, data['message'], data['utc'],
                 data['roomId'], session['user_id'], 1, data['file_name'])
    socketio.emit('announce message', data, broadcast=True)


@app.route("/chat/<int:channel_id>")
@app.route("/chat", methods=['POST', 'GET'])
def chat_page(channel_id=0):
    if request.method == 'POST':
        username = request.form.get("username")
        if username not in users:
            session.pop('username', None)
            session.pop('logged_in', None)
            response = {
                'success': 'false'
            }
            return jsonify(response)
    else:
        if 'logged_in' not in session:
            return redirect(url_for('login_page'))
        return render_template("chat.html")


@app.route('/register', methods=['POST'])
def create_user():
    response = {}
    username = request.form.get("username")
    password = request.form.get("password")
    pw_hash = bcrypt.generate_password_hash(password)
    pw_hash = pw_hash.decode('utf8')

    try:
        # Connect to database and create a new user if doesn't already exist
        results = db.execute("Select * from user").fetchall()
        print(results)
        user_id = add_user(db, username, pw_hash)

        session['username'] = username
        session['logged_in'] = True
        session['user_id'] = user_id
        # Adding details to the response to be sent back
        response['success'] = True
        response['message'] = 'Registered successfully!'
        response['username'] = username
        return jsonify(response)

    except UserExistsError as e:
        response['success'] = False
        response['message'] = 'Username taken, please use some other username!'
        return jsonify(response)


@app.route('/logout')
def drop_session():
    if session.get('username', None) is None:
        return redirect(url_for('login_page'))
    else:
        try:
            user = session['username']
            session.pop('username', None)
            session.pop('logged_in', None)
            session.pop('recentChatroom', None)
            session.pop('usr', None)
            time.sleep(2)
            socketio.emit(
                'user left', {'users': None, 'user': user}, broadcast=True)
            return redirect(url_for('login_page'))
        except Exception as e:
            return e


@app.route('/channel', methods=['POST'])
def create_channel():
    payload = request.get_json()
    channel_name = payload['channel']

    try:
        if payload.get('private', False):
            cid = add_channel(db, None, channel_name, isPrivate=True)
        else:
            cid = add_channel(db, session['user_id'], channel_name)
        response = {
            'success': 'true',
            'channel_id': cid
        }

        print(channel_name+" created successfully...")
        return jsonify(response)
    except ChannelExistsError as e:
        response = {
            'success': 'false',
            'reason': 'Already exists'
        }
        return jsonify(response)
    except MaxChannelCreatedError as e:
        response = {
            'success': 'false',
            'reason': 'Limit reached'
        }
        return jsonify(response)


@socketio.on('new channel')
def announce_channel(data):
    try:

        channelList = get_channels(db)
        response = {
            'channels': convert(channelList)
        }

        emit('channel created', response, broadcast=True, include_self=False)
    except Exception as e:
        print(e)


@socketio.on('get channels')
def get_channels_event():
    try:

        channelList = get_channels(db)
        response = {
            'channels': convert(channelList),
            'recentChatroom': session.get('recentChatroom', None)
        }

        emit('total channels', response)
    except Exception as e:
        print(e)


def filter_dm(data, x):
    first = [[item[0], item[1].split(x)] for item in data]
    temp = [item[1].remove('') for item in first]
    first = [[item[0], item[1][0].replace('-', '')] for item in first]
    print(first)

    return first


@socketio.on('get users')
def get_users_from_database(data):
    try:

        users = get_users(db, data['user'])

        new_users = filter_dm(users, data['user'])
        response = {
            'users': new_users
        }
        emit('total users', response)

    except Exception as e:
        print(e)


@socketio.on('subscribe')
def subscribe(data):
    try:
        room = data['room']

        join_room(room)

    except Exception as e:
        print(e)


@socketio.on("send message")
def message(data):
    try:
        send_message(db, data['message'], data['utc'],
                     data['roomId'], session['user_id'])
        message_data = {
            'username': data['username'],
            'message': data['message'],
            'room': data['room'],
            'roomId': data['roomId'],
            'utc': data['utc'],
            'md5': get_md5(db, data['username']),
            'is_file': False
        }

        emit('announce message', message_data,
             room=data['room'], broadcast=True)

    except Exception as e:
        print(e)


@socketio.on('server connect')
def conn(data):
    emit('user joined', data, broadcast=True)


@socketio.on('notify user')
def noti(data):
    print('This person received a new message!')
    print(data)
    emit('new dm', room=data['user'])


@socketio.on('get messages')
def get_messages_event(data):
    try:
        result = get_messages(db, data['room'])
        emit('total messages', convert(result))
    except Exception as e:
        print(e)


@socketio.on('typing')
def get_typing(data):
    try:
        emit('someone is typing', data, broadcast=True, include_self=False)
    except Exception as e:
        print(e)


@socketio.on('private_message', namespace='/private')
def private_message(payload):
    try:
        print(users)
        receiver_sid = users[payload['receiver']]['sid']

        response = {
            'message': payload['message'],
            'utc': payload['utc'],
            'sender': payload['sender']
        }
        print(users)
        print(response)
        emit('new_private_message', response, room=receiver_sid)
    except Exception as e:
        print(e)


if __name__ == '__main__':
    socketio.run(app, debug=True)
