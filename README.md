# AWS ES Proxy
Forked/Enhanced version from [commit 2c4374c](https://github.com/santthosh/aws-es-kibana/commit/2c4374c1bcdbb8a4f38dd4bdc16f2eb48c7a33e9) by [Santthosh Selvadurai](https://github.com/santthosh).
Also refer to [Loading Credentials in Node.js from the Shared Credentials File](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html).

This is the solution for accessing your cluster if you have [configured access policies](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/es-createupdatedomains.html#es-createdomain-configure-access-policies) for your ES domain.
AWS ElasticSearch/Kibana Proxy with authentication to access your [AWS ES](https://aws.amazon.com/elasticsearch-service/) cluster.

## Usage

Install the npm module

    npm install -g aws-es-proxy-node

Make sure you have credential profile in ~/.aws/credentials

    AWS_PROFILE=saml aws-es-proxy-node <cluster-endpoint>
Alternatively, you can set AWS credentials

    export AWS_ACCESS_KEY_ID=XXXXXXXXXXXXXXXXXXX
    export AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXX
    export AWS_SESSION_TOKEN=XXXXXXXXXXXXXXXXXXX
    aws-es-proxy-node <cluster-endpoint>

Where cluster-endpoint is a hostname (i.e. search-xxxxx.us-east-1.es.amazonaws.com, do not include the `http` or `https`).

## Examples
Example with multiple cluster-endpoints and ports:

    aws-es-proxy-node\
        -e endpointe.us-east-1.es.amazonaws.com\
        -e endpoint4.us-east-1.es.amazonaws.com\
        -f saml\
        -p 9201

![aws-es-kibana](https://raw.githubusercontent.com/glsjay/aws-es-kibana/master/aws-es-proxy-node-example.png)

Get help instruction:  

    aws-es-proxy-node --help
    usage: index [options] <aws-es-cluster-endpoint>
    Options:
      -e, --endpoint      the es address(es) to bind                        [string]
      -b, --bind-address  the ip address to bind to  [string] [default: "127.0.0.1"]
      -p, --port          the port to bind to               [number] [default: 9200]
      -r, --region        the region of the Elasticsearch cluster           [string]
      -u, --user          the username to access the proxy     [default: "lgong200"]
      -a, --password      the password to access the proxy
      -s, --silent        remove figlet banner                      [default: false]
      -H, --health-path   URI path for health check                         [string]
      -l, --limit         request limit                         [default: "10000kb"]
      -f, --aws-profile   request aws profile                      [default: "saml"]
      --help              Show help                                        [boolean]
      --version           Show version number                              [boolean]

## Credits

Forked from this [Santthosh Selvadurai](https://github.com/santthosh/aws-es-kibana/commit/2c4374c1bcdbb8a4f38dd4bdc16f2eb48c7a33e9)

Adopted from this [gist](https://gist.github.com/nakedible-p/ad95dfb1c16e75af1ad5). Thanks [@nakedible-p](https://github.com/nakedible-p)
