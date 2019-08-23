import calendar
import sqlite3
import uuid
from datetime import datetime
import hashlib
from pprint import pprint

conn = None


class UserExistsError(Exception):
    pass


class ChannelExistsError(Exception):
    pass


class MaxChannelCreatedError(Exception):
    pass


def connect(database):
    global conn
    if not isinstance(database, str):
        raise TypeError("database argument isn't a string")
    conn = sqlite3.connect(database)


def disconnect(database):
    global conn
    if not isinstance(database, str):
        raise TypeError("database argument isn't a string")
    conn.close()


def add_user(conn, username, password):
    print('add_user() called...')
    """
    Adds a user to the user table
        :param username: a string with user's username
    """
    user_id = uuid.uuid5(uuid.NAMESPACE_URL, username).int % 1000000000000
    md5 = hashlib.md5(username.encode()).hexdigest()

    try:
        data = conn.execute(
            "select * from user where username=:username", {"username": username}).fetchone()
        if data is not None:
            raise UserExistsError(
                'User with the username {0} already exists, try again!'.format(username))
        else:
            conn.execute("INSERT INTO user (user_id, username, md5, no_of_channels, password) VALUES (:user_id,:username,:md5, 0, :password);",
                         {"user_id": user_id, "username": username, "md5": md5, "password": password})
            conn.commit()
            print('User {0} created successfully.'.format(username))
            return user_id

    except Exception as e:
        raise


def add_channel(conn, user_id, channel_name, isPrivate=None):
    print('add_channel() called...')
    """
    Adds a channel to the channel table in the database
        user_id: user_id of the user that created this channel
        channel_name: a string containing the name of the channel to be created
    """
    if not isinstance(channel_name, str):
        raise TypeError(
            "channel_name '{}' is not a string".format(channel_name))

    if isPrivate is not True:
        name = channel_name.lower()
    else:
        name = channel_name

    channel_id = uuid.uuid5(
        uuid.NAMESPACE_URL, channel_name).int % 1000000000000
    try:

        data = conn.execute(
            "select * from channel where channel_name=:channel_name;", {"channel_name": name}).fetchone()

        if data is not None:
            raise ChannelExistsError('Channel named {0} already exists, try again!'.format(
                channel_name))
        elif isPrivate is True:
            conn.execute("PRAGMA foreign_keys=on;")
            conn.commit()
            conn.execute(
                "INSERT INTO channel (channel_id, channel_name, owner_id) VALUES (:channel_id,:name,:user_id);",
                {"channel_id": channel_id, "name": name, "user_id": user_id})
            print("{} conversation started successfully.".format(name))
            return channel_id
        else:
            user_row = conn.execute(
                "SELECT * from user where user_id=:user_id", {"user_id": user_id}).fetchone()

            if user_row is not None:

                if user_row[3] > 0:
                    raise MaxChannelCreatedError("User {0} has already created the max number of channels permitted to them.".format(
                        user_row[1]))
                else:
                    # Enforces foreign keys
                    conn.execute("PRAGMA foreign_keys=on;")
                    conn.commit()
                    conn.execute(
                        "INSERT INTO channel (channel_id, channel_name, owner_id) VALUES (:channel_id,:name,:user_id);", {"channel_id": channel_id, "name": name, "user_id": user_id})
                    conn.execute("UPDATE user SET no_of_channels = 1 WHERE user_id = :user_id", {
                        "user_id": user_id})
                    conn.commit()
                    print("{0} created channel named {1} successfully.".format(
                        user_row[1], name))
                    return channel_id
            else:
                raise NameError("No such user found")

    except Exception as e:
        raise


def send_message(conn, message_content, timestamp, channel_id, sender_id, is_file=0, file_name=None):
    print('send_message() called...')
    print(timestamp)
    """
    This function is used to save a message into the database
        :param message_content: The string containing the message
        :param timestamp: Timestamp at which the message was sent in UTC format
        :param channel_id: ID of the channel in which the message was sent
        :param sender_id: ID of the sender of the message
    """
    if not message_content:
        raise ValueError('Empty messages cannot be sent!')

    message_id = uuid.uuid5(uuid.NAMESPACE_URL, str(
        timestamp)).int % 1000000000000000

    # Enforces foreign keys
    try:
        conn.execute("PRAGMA foreign_keys=on;")
        conn.commit()
        conn.execute("INSERT INTO message (message_id, message_content, timestamp, channel_id, sender_id, file, file_name) VALUES (:message_id, :message_content, :timestamp, :channel_id, :sender_id, :is_file, :file_name);",
                     {"message_id": message_id, "message_content": message_content, "timestamp": timestamp, "channel_id": channel_id, "sender_id": sender_id, "is_file": is_file, "file_name": file_name})
        conn.commit()
        print("{0} sent {1} in channel with id {2} at {3}".format(
            sender_id, message_content, channel_id, timestamp))
    except Exception as e:
        # raise will pass the exception to the calling function
        raise


def g(x): return [i[0] for i in x]


def get_users(conn, user):
    print('get_users() called...')
    result = conn.execute(
        "select * from(select channel_id, channel_name from channel where owner_id IS NULL) where channel_name LIKE :user;", {'user': '%'+user+'%'}).fetchall()
    print(result)
    return result


def get_channels(conn):
    print('get_channels() called...')
    result = conn.execute(
        "select channel_id, channel_name from channel where owner_id IS NOT NULL order by channel_name;").fetchall()
    return result


def get_messages(conn, channel_id):
    result = conn.execute(
        'select m.message_id, m.message_content, m.timestamp, m.channel_id, u.username, u.md5, m.file, m.file_name from message as m inner join user as u on m.sender_id = u.user_id where m.channel_id = :channel_id order by m.timestamp;', {'channel_id': channel_id}).fetchall()
    return result


def get_md5(conn, username):
    result = conn.execute('select md5 from user where username=:username;', {
                          'username': username}).fetchone()
    return result[0]
