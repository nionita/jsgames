# -*- coding: utf-8 -*-

# Copied and adapted from https://github.com/miguelgrinberg/slam/blob/master/slam/plugins/wsgi.py

import base64
from io import BytesIO
import sys
try:
    from urllib import quote
except ImportError:  # pragma: no cover
    from urllib.parse import quote

from app import app

def run_wsgi_app(event, context):
    query_string = None
    if event.get('queryStringParameters') is not None:
        query_string = '&'.join(
            [quote(k) + '=' + quote(v)
             for k, v in event['queryStringParameters'].items()])
    headers = event.get('headers') or {}
    body = event.get('body')
    if body is None:
        body = b''
    else:
        body = body.encode('utf-8')

    # create a WSGI environment for this request
    environ = {
        'REQUEST_METHOD': event.get('httpMethod', 'GET'),
        'SCRIPT_NAME': '',
        'PATH_INFO': event.get('path', '/'),
        'QUERY_STRING': query_string,
        'SERVER_NAME': '',
        'SERVER_PORT': 80,
        'HTTP_HOST': '',
        'SERVER_PROTOCOL': 'https',
        'CONTENT_TYPE': headers.get('Content-Type', ''),
        'CONTENT_LENGTH': headers.get('Content-Length', str(len(body))),
        'wsgi.version': '',
        'wsgi.url_scheme': '',
        'wsgi.input': BytesIO(body),
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': False,
        'wsgi.run_once': True,
        'lambda.event': event,
        'lambda.context': context,
    }

    # add any headers that came with the request
    for h, v in headers.items():
        environ['HTTP_' + h.upper().replace('-', '_')] = v

    status_headers = [None, None]
    body = []

    def write(item):
        body.append(item)

    def start_response(status, headers):
        status_headers[:] = [status, headers]
        return write

    # invoke the WSGI app
    app_iter = app(environ, start_response)
    try:
        for item in app_iter:
            body.append(item)
    finally:
        if hasattr(app_iter, 'close'):
            app_iter.close()

    # format the response as required by the api gateway proxy integration
    status = status_headers[0].split()
    headers = status_headers[1]
    body = b''.join(body)
    try:
        body = body.decode('utf-8')
        b64 = False
    except UnicodeDecodeError:
        body = base64.b64encode(body).decode('utf-8')
        b64 = True

    return {
        'statusCode': int(status[0]),
        'headers': {h[0]: h[1] for h in headers},
        'body': body,
        'isBase64Encoded': b64
    }