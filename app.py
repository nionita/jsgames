# -*- coding: utf-8 -*-

from flask import Flask, jsonify, render_template, url_for

app = Flask(__name__)

#app.config['SECRET_KEY'] = 'Did you get it?'

local = True

if local:
    app.config['CDN'] = '/static'
else:
    #app.config['CDN'] = '//d3ue3izxgq2sal.cloudfront.net'
    app.config['CDN'] = 'https://s3-eu-west-1.amazonaws.com/storage.acons.at/static'

@app.route('/')
def index():
    return jsonify({'message': 'test your app'})

@app.route('/play/<user>')
def play(user):
    if user in ('luca', 'nicu', 'mami', 'jack'):
        return render_template('play.html', title='Playing with' + user, user=user, cdn=app.config['CDN'])