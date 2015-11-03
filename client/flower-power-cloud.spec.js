var proxyquire = require('proxyquire');
describe('auth', function() {
  it('shold call authenticate', function(done) {
    var auth = proxyquire('./flower-power-cloud', {
      request: function(opts, cb) {
        var qs = opts.qs;
        opts.url.should.eql('https://apiflowerpower.parrot.com/user/v1/authenticate');
        qs.grant_type.should.eql('password');
        qs.client_id.should.eql('foo');
        qs.client_secret.should.eql('bar');
        qs.username.should.eql('foobar');
        qs.password.should.eql('barfoo');
        cb(null, null, {
          access_token: 'FOO-BAR'
        });
      }
    }).auth;

    auth({
      clientId: 'foo',
      clientSecret: 'bar',
      username: 'foobar',
      password: 'barfoo'
    }, function(err, token) {
      (err == null).should.be.ok;
      token.should.eql('FOO-BAR');
      done();
    });
  });


  it('shold forward error', function(done) {
    var auth = proxyquire('./flower-power-cloud', {
      request: function(opts, cb) {
        cb(new Error('Not found'));
      }
    }).auth;

    auth({
      clientId: 'foo',
      clientSecret: 'bar',
      username: 'foobar',
      password: 'barfoo'
    }, function(err, token) {
      (err == null).should.not.be.ok
      err.should.instanceof.Error;
      done();
    });
  });
});
