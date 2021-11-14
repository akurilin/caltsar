# Prereqs

You will need liquibase in order to migrate the DB:

`docker pull postgres:13.4`
`docker volume create postgres-volume`
`docker pull liquibase/liquibase`

### Liquibase add new migration

Generate new timestamp for the migration as

`date +"%s"`

### Sample profile contents you get from the Google API

// Sample Google Profile:
//
// {
//   provider: 'google',
//   sub: '113738270040001178733',
//   id: '113738270040001178733',
//   displayName: 'Alexandr Kurilin',
//   name: { givenName: 'Alexandr', familyName: 'Kurilin' },
//   given_name: 'Alexandr',
//   family_name: 'Kurilin',
//   email_verified: true,
//   verified: true,
//   language: 'en',
//   locale: undefined,
//   email: 'alexandr.kurilin@gmail.com',
//   emails: [ { value: 'alexandr.kurilin@gmail.com', type: 'account' } ],
//   photos: [
//     {
//       value: 'https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC=s96-c',
//       type: 'default'
//     }
//   ],
//   picture: 'https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC=s96-c',
//   _raw: '{\n' +
//     '  "sub": "113738270040001178733",\n' +
//     '  "name": "Alexandr Kurilin",\n' +
//     '  "given_name": "Alexandr",\n' +
//     '  "family_name": "Kurilin",\n' +
//     '  "picture": "https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC\\u003ds96-c",\n' +
//     '  "email": "alexandr.kurilin@gmail.com",\n' +
//     '  "email_verified": true,\n' +
//     '  "locale": "en"\n' +
//     '}',
//   _json: {
//     sub: '113738270040001178733',
//     name: 'Alexandr Kurilin',
//     given_name: 'Alexandr',
//     family_name: 'Kurilin',
//     picture: 'https://lh3.googleusercontent.com/a/AATXAJwlhjEuJh-E-Ey7I27qxLRk_J_CBYkQQYxFzDXC=s96-c',
//     email: 'alexandr.kurilin@gmail.com',
//     email_verified: true,
//     locale: 'en'
//   }
// }
// { googleId: '113738270040001178733' }
//
